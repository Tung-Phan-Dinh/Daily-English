import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  supabaseUrl: () => req("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => req("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  serviceRoleKey: () => req("SUPABASE_SERVICE_ROLE_KEY"),
  openaiKey: () => process.env.OPENAI_API_KEY ?? "",
  modelFast: () => process.env.OPENAI_MODEL_FAST || "gpt-5-mini",
  modelGrader: () => process.env.OPENAI_MODEL_GRADER || "gpt-5",
  cronSecret: () => process.env.CRON_SECRET ?? "",
  aiDailyCallLimit: () => Number(process.env.AI_DAILY_CALL_LIMIT || 80),
  aiMonthlyBudgetUsd: () => Number(process.env.AI_MONTHLY_BUDGET_USD || 5),
  /** "input,output" USD per million tokens */
  priceFast: () => parsePrice(process.env.OPENAI_PRICE_FAST, [0.2, 1.2]),
  priceGrader: () => parsePrice(process.env.OPENAI_PRICE_GRADER, [2, 12]),
  appUrl: () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100",
};

function parsePrice(v: string | undefined, fallback: [number, number]): [number, number] {
  if (!v) return fallback;
  const [a, b] = v.split(",").map(Number);
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : fallback;
}
