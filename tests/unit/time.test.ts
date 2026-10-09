import { describe, expect, it } from "vitest";
import { addDays, dayKind, dayStart, localDate, nextBoundary, weekStart } from "@/lib/time";

describe("day boundary (04:00 local)", () => {
  const tz = "Asia/Ho_Chi_Minh"; // UTC+7, no DST

  it("03:59 local still belongs to the previous day", () => {
    // 2026-10-09 20:59 UTC = 2026-10-10 03:59 ICT
    expect(localDate(tz, new Date("2026-10-09T20:59:00Z"))).toBe("2026-10-09");
  });

  it("04:00 local starts the new day", () => {
    expect(localDate(tz, new Date("2026-10-09T21:00:00Z"))).toBe("2026-10-10");
  });

  it("next boundary is the next 04:00 local", () => {
    expect(nextBoundary(tz, new Date("2026-10-09T12:00:00Z")).toISOString()).toBe("2026-10-09T21:00:00.000Z");
  });

  it("handles DST zones (Melbourne switches on 4 Oct 2026)", () => {
    const mel = "Australia/Melbourne";
    expect(dayStart(mel, "2026-10-03").toISOString()).toBe("2026-10-02T18:00:00.000Z"); // AEST +10
    expect(dayStart(mel, "2026-10-10").toISOString()).toBe("2026-10-09T17:00:00.000Z"); // AEDT +11
  });

  it("is independent of the device clock: same instant, same date", () => {
    const at = new Date("2026-10-10T01:00:00Z");
    expect(localDate(tz, at)).toBe(localDate(tz, new Date(at.getTime())));
  });
});

describe("calendar helpers", () => {
  it("weekStart returns Monday", () => {
    expect(weekStart("2026-10-09")).toBe("2026-10-05"); // Friday → Monday
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // Sunday → previous Monday
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
  });
  it("addDays crosses months", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
  it("dayKind", () => {
    expect(dayKind("2026-10-10")).toBe("saturday");
    expect(dayKind("2026-10-11")).toBe("sunday");
    expect(dayKind("2026-10-09")).toBe("weekday");
  });
});
