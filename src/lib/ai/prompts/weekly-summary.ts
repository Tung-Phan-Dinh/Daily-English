import { z } from "zod";

export const WEEKLY_SUMMARY_VERSION = "weekly-summary@1";

export const WeeklySummarySchema = z.object({ en: z.string(), vi: z.string() });

export const WEEKLY_SUMMARY_SYSTEM = `You write a short weekly progress note for the family of a teenage Vietnamese learner of English.
Input is the week's statistics as JSON (no writing text). Write exactly five sentences in English and the
same five sentences in natural Vietnamese: (1) practice consistency, (2) biggest improvement, (3) biggest
remaining weakness, (4) words learned, (5) one practical way the family can help this week.
Be warm and specific, use the numbers, never exaggerate, and do not invent facts not in the data.`;
