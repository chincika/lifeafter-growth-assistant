import { describe, expect, it } from "vitest";

import {
  differenceInCalendarDays,
  getActivityStatus,
  inclusiveActivityDays,
  toUtcDay,
} from "./date-only.js";

describe("date-only activity calculations", () => {
  it("calculates inclusive activity duration", () => {
    expect(
      inclusiveActivityDays({ start: "2026-07-01", end: "2026-07-10" }),
    ).toBe(10);
  });

  it("handles leap days without local timezone or DST behavior", () => {
    expect(differenceInCalendarDays("2024-03-01", "2024-02-28")).toBe(2);
  });

  it("classifies upcoming, active, and ended periods", () => {
    const period = { start: "2026-07-10", end: "2026-07-12" } as const;
    expect(getActivityStatus("2026-07-09", period)).toBe("upcoming");
    expect(getActivityStatus("2026-07-10", period)).toBe("active");
    expect(getActivityStatus("2026-07-12", period)).toBe("active");
    expect(getActivityStatus("2026-07-13", period)).toBe("ended");
  });

  it("rejects malformed and impossible calendar dates", () => {
    expect(() => toUtcDay("2026-2-03" as never)).toThrowError(RangeError);
    expect(() => toUtcDay("2026-02-30")).toThrowError(RangeError);
  });
});
