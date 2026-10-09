import { z } from "zod";

export const WHY_VERSION = "why@1";

export const WhySchema = z.object({
  explanation_en: z.string(),
  explanation_vi: z.string(),
  examples: z.array(z.object({ en: z.string(), note: z.string() })),
});

export const WHY_SYSTEM = `Explain an English grammar exercise answer to a Vietnamese learner (IELTS band 5.5).
Give a clear explanation (English under 80 words, natural Vietnamese under 100 words), mention the
Vietnamese transfer reason if relevant, and give exactly two more short example sentences with a one-line note each.`;
