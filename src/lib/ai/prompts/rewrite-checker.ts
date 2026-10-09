import { z } from "zod";

export const REWRITE_CHECKER_VERSION = "rewrite-checker@1";

export const RewriteCheckSchema = z.object({
  fixed: z.boolean(),
  new_errors: z.array(z.string()),
  hint_en: z.string(),
  hint_vi: z.string(),
});

export const REWRITE_CHECKER_SYSTEM = `A Vietnamese learner is rewriting one sentence from his paragraph to fix a flagged error.
Decide whether the rewrite fixes the flagged error without introducing new serious errors.
Small style differences are fine. If not fixed, give ONE hint (English under 20 words, plus natural Vietnamese),
never the corrected sentence itself. new_errors lists any new errors briefly (may be empty).
If fixed, hints may be short praise.`;
