// Dashboard strings for viewers (English or Vietnamese per viewer).

export type Lang = "en" | "vi";

const S = {
  thisWeek: { en: "This week", vi: "Tuần này" },
  streak: { en: "day streak", vi: "ngày liên tiếp" },
  minutes: { en: "min this week", vi: "phút tuần này" },
  weeklySummary: { en: "Weekly summary", vi: "Tóm tắt tuần" },
  insights: { en: "What stands out", vi: "Điểm nổi bật" },
  wordsMastered: { en: "Words mastered", vi: "Từ đã thuộc" },
  grammarMastered: { en: "Grammar points mastered", vi: "Điểm ngữ pháp đã nắm" },
  readingAccuracy: { en: "Reading accuracy (7 days)", vi: "Đọc hiểu đúng (7 ngày)" },
  writingBand: { en: "Writing estimate (7-day avg)", vi: "Ước tính bài viết (TB 7 ngày)" },
  thisWeekChange: { en: "this week", vi: "tuần này" },
  noData: { en: "No data yet", vi: "Chưa có dữ liệu" },
  charts: { en: "Charts", vi: "Biểu đồ" },
  calendar: { en: "Practice calendar", vi: "Lịch luyện tập" },
  calendarCaption: { en: "Good: most squares filled, 20–30 minutes a day.", vi: "Tốt: hầu hết các ô có màu, 20–30 phút mỗi ngày." },
  mistakes: { en: "Mistakes over time", vi: "Lỗi theo thời gian" },
  mistakesCaption: { en: "Errors per 100 words in writing. Good: lines going down.", vi: "Số lỗi trên 100 từ. Tốt: các đường đi xuống." },
  grammarMap: { en: "Grammar map", vi: "Bản đồ ngữ pháp" },
  grammarMapCaption: { en: "24 points in four phases. Good: tiles turning green from the top.", vi: "24 điểm ngữ pháp, 4 giai đoạn. Tốt: các ô chuyển xanh dần." },
  vocabGrowth: { en: "Vocabulary growth", vi: "Vốn từ vựng" },
  vocabCaption: { en: "Words by memory strength. Good: the mastered band keeps growing.", vi: "Từ theo mức độ ghi nhớ. Tốt: phần 'đã thuộc' tăng dần." },
  recall: { en: "Review recall", vi: "Tỉ lệ nhớ khi ôn" },
  recallCaption: { en: "% correct on due cards each week. Good: 85% or more.", vi: "% đúng khi ôn mỗi tuần. Tốt: từ 85% trở lên." },
  reading: { en: "Reading", vi: "Đọc hiểu" },
  readingCaption: { en: "Accuracy by question type. Good: True/False/Not Given above 70%.", vi: "Độ chính xác theo dạng câu hỏi. Tốt: True/False/Not Given trên 70%." },
  readingSpeed: { en: "Reading speed", vi: "Tốc độ đọc" },
  readingSpeedCaption: { en: "Words per minute. Good: slowly rising while accuracy holds.", vi: "Số từ mỗi phút. Tốt: tăng dần mà vẫn đúng." },
  writingChart: { en: "Writing estimate", vi: "Ước tính điểm viết" },
  writingCaption: { en: "AI estimate, 7-day average. Good: moving toward 6.0–6.5.", vi: "Ước tính bằng AI, trung bình 7 ngày. Tốt: tiến tới 6.0–6.5." },
  recentWriting: { en: "Recent writing", vi: "Bài viết gần đây" },
  noWriting: { en: "No graded writing yet.", vi: "Chưa có bài viết được chấm." },
  showTable: { en: "Show as a table", vi: "Xem dạng bảng" },
  lookups: { en: "Dictionary lookups", vi: "Tra từ điển" },
  topLookups: { en: "Most looked-up words (14 days)", vi: "Từ tra nhiều nhất (14 ngày)" },
  aiEstimate: { en: "AI estimate", vi: "Ước tính AI" },
  learning: { en: "Learning", vi: "Đang học" },
  review: { en: "Review", vi: "Đang ôn" },
  mastered: { en: "Mastered", vi: "Đã thuộc" },
  notStarted: { en: "Not started", vi: "Chưa học" },
  phase: { en: "Phase", vi: "Giai đoạn" },
  dueReviews: { en: "reviews due", vi: "thẻ cần ôn" },
  skipped: { en: "blocks skipped", vi: "phần bị bỏ qua" },
} as const;

export type StringKey = keyof typeof S;

export function t(key: StringKey, lang: Lang): string {
  return S[key][lang];
}
