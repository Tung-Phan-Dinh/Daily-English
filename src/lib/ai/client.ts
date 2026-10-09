import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export class AiUnavailableError extends Error {
  constructor(
    message: string,
    public reason: "no_key" | "daily_limit" | "budget" | "api_error" | "invalid_output",
  ) {
    super(message);
  }
}

let _client: OpenAI | null = null;
export function openai(): OpenAI {
  if (!env.openaiKey()) throw new AiUnavailableError("AI is not configured yet.", "no_key");
  _client ??= new OpenAI({ apiKey: env.openaiKey(), maxRetries: 1, timeout: 45_000 });
  return _client;
}

export type Tier = "fast" | "grader";

export function modelFor(tier: Tier) {
  return tier === "fast" ? env.modelFast() : env.modelGrader();
}

// USD per million tokens. Known IDs first; otherwise the tier price from env.
const KNOWN_PRICES: Record<string, [number, number]> = {
  "gpt-5": [1.25, 10],
  "gpt-5-mini": [0.25, 2],
  "gpt-5-nano": [0.05, 0.4],
  "gpt-5.4-mini": [0.75, 4.5],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4o-mini": [0.15, 0.6],
};

export function estimateCost(model: string, tier: Tier, input: number, output: number, batch = false): number {
  const [pin, pout] = KNOWN_PRICES[model] ?? (tier === "fast" ? env.priceFast() : env.priceGrader());
  const cost = (input * pin + output * pout) / 1_000_000;
  return batch ? cost / 2 : cost;
}

/** Reasoning models reject `temperature`; use low effort instead. */
function samplingFor(model: string) {
  if (/^(gpt-5|o\d)/.test(model)) return { reasoning: { effort: "low" as const } };
  return { temperature: 0.2 };
}

export async function logAiCall(row: {
  user_id: string | null;
  route: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  ok: boolean;
  prompt_version?: string;
}) {
  try {
    await createAdminClient().from("ai_calls").insert(row);
  } catch {
    // Logging must never break the learner's flow.
  }
}

/** Stop with a friendly message when the daily call limit or monthly budget is hit. */
export async function assertAiBudget() {
  if (!env.openaiKey()) throw new AiUnavailableError("AI is not configured yet.", "no_key");
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [{ count }, { data: spend }] = await Promise.all([
    admin.from("ai_calls").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
    admin.from("ai_calls").select("cost_usd").gte("created_at", monthStart.toISOString()),
  ]);
  if ((count ?? 0) >= env.aiDailyCallLimit()) {
    throw new AiUnavailableError("Today's AI limit is reached. Your work is saved and will be checked later.", "daily_limit");
  }
  const total = (spend ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  if (total >= env.aiMonthlyBudgetUsd()) {
    throw new AiUnavailableError("This month's AI budget is used up. Your work is saved and will be checked next month.", "budget");
  }
}

type CallArgs<S extends z.ZodType> = {
  route: string;
  userId: string | null;
  tier: Tier;
  system: string;
  user: string;
  schema: S;
  schemaName: string;
  promptVersion: string;
  maxOutputTokens?: number;
  skipBudget?: boolean;
};

/** One structured-output call: JSON-schema output, zod-validated, logged. */
export async function callStructured<S extends z.ZodType>(args: CallArgs<S>): Promise<z.infer<S>> {
  if (!args.skipBudget) await assertAiBudget();
  const model = modelFor(args.tier);
  let input = 0;
  let output = 0;
  try {
    const res = await openai().responses.parse({
      model,
      instructions: args.system,
      input: args.user,
      max_output_tokens: args.maxOutputTokens ?? 4000,
      text: { format: zodTextFormat(args.schema, args.schemaName) },
      ...samplingFor(model),
    });
    input = res.usage?.input_tokens ?? 0;
    output = res.usage?.output_tokens ?? 0;
    const parsed = args.schema.safeParse(res.output_parsed);
    if (!parsed.success) throw new AiUnavailableError("The AI answer was malformed.", "invalid_output");
    await logAiCall({
      user_id: args.userId, route: args.route, model, input_tokens: input, output_tokens: output,
      cost_usd: estimateCost(model, args.tier, input, output), ok: true, prompt_version: args.promptVersion,
    });
    return parsed.data;
  } catch (err) {
    await logAiCall({
      user_id: args.userId, route: args.route, model, input_tokens: input, output_tokens: output,
      cost_usd: estimateCost(model, args.tier, input, output), ok: false, prompt_version: args.promptVersion,
    });
    if (err instanceof AiUnavailableError) throw err;
    throw new AiUnavailableError("The AI service is not responding right now.", "api_error");
  }
}

/** Streaming variant: reports raw JSON text as it grows, returns the validated result. */
export async function callStructuredStream<S extends z.ZodType>(
  args: CallArgs<S> & { onText: (textSoFar: string) => void },
): Promise<z.infer<S>> {
  if (!args.skipBudget) await assertAiBudget();
  const model = modelFor(args.tier);
  let input = 0;
  let output = 0;
  try {
    const stream = openai().responses.stream({
      model,
      instructions: args.system,
      input: args.user,
      max_output_tokens: args.maxOutputTokens ?? 6000,
      text: { format: zodTextFormat(args.schema, args.schemaName) },
      ...samplingFor(model),
    });
    let text = "";
    stream.on("response.output_text.delta", (e) => {
      text += e.delta;
      args.onText(text);
    });
    const res = await stream.finalResponse();
    input = res.usage?.input_tokens ?? 0;
    output = res.usage?.output_tokens ?? 0;
    const parsed = args.schema.safeParse(res.output_parsed);
    if (!parsed.success) throw new AiUnavailableError("The AI answer was malformed.", "invalid_output");
    await logAiCall({
      user_id: args.userId, route: args.route, model, input_tokens: input, output_tokens: output,
      cost_usd: estimateCost(model, args.tier, input, output), ok: true, prompt_version: args.promptVersion,
    });
    return parsed.data;
  } catch (err) {
    await logAiCall({
      user_id: args.userId, route: args.route, model, input_tokens: input, output_tokens: output,
      cost_usd: estimateCost(model, args.tier, input, output), ok: false, prompt_version: args.promptVersion,
    });
    if (err instanceof AiUnavailableError) throw err;
    throw new AiUnavailableError("The AI service is not responding right now.", "api_error");
  }
}

export { zodTextFormat };
