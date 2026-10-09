// Fixed curriculum facts shared by server and client.

export const ERROR_CODES = [
  "TNS", "ART", "PLU", "SVA", "VFM", "WFM", "PRP", "PSV", "CLS", "WOR", "CNJ", "BE",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Codes the writing grader may also emit (not drilled by the curriculum). */
export const WRITING_ONLY_CODES = ["SPL", "COL", "WCH", "OTH"] as const;
export type AnyErrorCode = ErrorCode | (typeof WRITING_ONLY_CODES)[number];

export const ERROR_LABELS: Record<AnyErrorCode, { en: string; vi: string }> = {
  TNS: { en: "Verb tense", vi: "Thì của động từ" },
  ART: { en: "Articles (a/an/the)", vi: "Mạo từ (a/an/the)" },
  PLU: { en: "Plurals & countable nouns", vi: "Số nhiều & danh từ đếm được" },
  SVA: { en: "Subject–verb agreement", vi: "Hòa hợp chủ ngữ – động từ" },
  VFM: { en: "Verb form (to/-ing/base)", vi: "Dạng động từ (to/-ing/nguyên mẫu)" },
  WFM: { en: "Word form", vi: "Dạng từ (danh/tính/trạng từ)" },
  PRP: { en: "Prepositions", vi: "Giới từ" },
  PSV: { en: "Passive voice", vi: "Câu bị động" },
  CLS: { en: "Comma splices & run-ons", vi: "Lỗi nối câu bằng dấu phẩy" },
  WOR: { en: "Word order", vi: "Trật tự từ" },
  CNJ: { en: "Doubled connectors", vi: "Dùng thừa liên từ (Although… but)" },
  BE: { en: "Missing 'to be'", vi: "Thiếu động từ 'to be'" },
  SPL: { en: "Spelling", vi: "Chính tả" },
  COL: { en: "Collocation", vi: "Kết hợp từ" },
  WCH: { en: "Word choice", vi: "Chọn từ" },
  OTH: { en: "Other", vi: "Lỗi khác" },
};

export const PRODUCTION_FORMATS = new Set([
  "typed_gap", "correct_error", "transform", "combine", "word_form", "translate", "upgrade",
]);
export const AI_CHECKED_FORMATS = new Set(["correct_error", "transform", "combine", "translate", "upgrade"]);

export const FORMAT_LABELS: Record<string, string> = {
  mcq: "Choose the answer",
  typed_gap: "Fill the gap",
  spot_error: "Spot the error",
  correct_error: "Correct the sentence",
  transform: "Rewrite with the key word",
  combine: "Combine the sentences",
  word_form: "Word form",
  translate: "Vietnamese → English",
  word_order: "Put the words in order",
  upgrade: "Upgrade the word",
};

export const BLOCKS = ["review", "grammar", "new_words", "reading", "writing", "check", "wrapup"] as const;
export type BlockId = (typeof BLOCKS)[number];

export const BLOCK_META: Record<BlockId, { title: string; titleVi: string; minutes: number }> = {
  review: { title: "Review", titleVi: "Ôn tập", minutes: 5 },
  grammar: { title: "Grammar focus", titleVi: "Ngữ pháp", minutes: 6 },
  new_words: { title: "New words", titleVi: "Từ mới", minutes: 5 },
  reading: { title: "Reading", titleVi: "Đọc hiểu", minutes: 5 },
  writing: { title: "Mini writing", titleVi: "Viết ngắn", minutes: 6 },
  check: { title: "Weekly check", titleVi: "Kiểm tra tuần", minutes: 8 },
  wrapup: { title: "Wrap-up", titleVi: "Tổng kết", minutes: 1 },
};

/** Weekday writing rotation (1 = Monday … 6 = Saturday). */
export const WRITING_ROTATION: Record<number, { type: string; min: number; max: number; label: string }> = {
  1: { type: "opinion", min: 80, max: 120, label: "Opinion paragraph" },
  2: { type: "chart", min: 60, max: 80, label: "Describe a mini chart" },
  3: { type: "paraphrase", min: 50, max: 70, label: "Paraphrase + intro sentence" },
  4: { type: "problem_solution", min: 80, max: 120, label: "Problem and solution" },
  5: { type: "adv_disadv", min: 80, max: 120, label: "Advantages vs disadvantages" },
  6: { type: "essay", min: 150, max: 200, label: "Short Task 2 essay" },
};

export const REVIEW_CAP = 20;
export const SKIP_NEW_WORDS_THRESHOLD = 40;
export const GRAMMAR_ITEMS_PER_SESSION = 10;
export const SESSIONS_PER_POINT = 3;
export const STREAK_FREEZES_PER_MONTH = 2;
export const WORD_MILESTONES = [100, 500, 1000];
export const XP = { correct: 10, newWord: 5, reading: 10, writing: 30, rewrite: 10 } as const;

/** IELTS question type labels. */
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  tfng: "True / False / Not Given",
  mcq: "Multiple choice",
  completion: "Sentence completion",
  headings: "Matching headings",
  summary: "Summary completion",
};
