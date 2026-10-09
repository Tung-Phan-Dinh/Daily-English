"use client";

/** Audio via the browser's built-in speech synthesis — no audio hosting cost. */
export function speak(text: string, accent: "en-GB" | "en-US" = "en-GB") {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = accent;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === accent) ?? window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  u.rate = 0.9;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  return true;
}

export function canSpeak() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
