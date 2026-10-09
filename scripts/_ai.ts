// OpenAI helper for offline content scripts (structured outputs, zod-validated, logged to ai_calls).
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { admin } from "./_shared.ts";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 2, timeout: 120_000 });
export const MODEL_FAST = process.env.OPENAI_MODEL_FAST || "gpt-5-mini";

export async function structured<S extends z.ZodType>(p: { system: string; user: string; schema: S; name: string; route: string; maxTokens?: number }): Promise<z.infer<S>> {
  if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENAI_API_KEY");
  const res = await client.responses.parse({
    model: MODEL_FAST,
    instructions: p.system,
    input: p.user,
    max_output_tokens: p.maxTokens ?? 16000,
    text: { format: zodTextFormat(p.schema, p.name) },
    ...(/^(gpt-5|o\d)/.test(MODEL_FAST) ? { reasoning: { effort: "low" as const } } : { temperature: 0.4 }),
  });
  const input = res.usage?.input_tokens ?? 0;
  const output = res.usage?.output_tokens ?? 0;
  const [pin, pout] = (process.env.OPENAI_PRICE_FAST ?? "0.25,2").split(",").map(Number);
  await admin().from("ai_calls").insert({
    user_id: null, route: p.route, model: MODEL_FAST, input_tokens: input, output_tokens: output,
    cost_usd: (input * pin + output * pout) / 1e6, ok: true, prompt_version: `${p.name}@script`,
  });
  if (res.status === "incomplete") {
    // Usually max_output_tokens: the JSON was cut off mid-way. Ask for fewer items per call.
    throw new Error(`OpenAI reply was cut off (${res.incomplete_details?.reason ?? "incomplete"}) after ${output} output tokens — request fewer items per call.`);
  }
  if (res.output_parsed == null) throw new Error("OpenAI returned no structured output (refusal or empty reply).");
  return p.schema.parse(res.output_parsed);
}
