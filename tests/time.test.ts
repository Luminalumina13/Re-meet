import { describe, expect, it } from "vitest";
import { addDays, localToUtc, tzOffsetMinutes, utcToLocal, weekday } from "@/lib/domain/time";
import { nextSaturday, upcomingWeekends, weekendFromSaturday } from "@/lib/domain/dates";

describe("time zones", () => {
  it("round-trips local <-> utc across DST", () => {
    // Kyiv winter: UTC+2
    expect(localToUtc("2026-11-21T08:30", "Europe/Kyiv")).toBe("2026-11-21T06:30:00.000Z");
    expect(utcToLocal("2026-11-21T06:30:00.000Z", "Europe/Kyiv")).toBe("2026-11-21T08:30");
    // Kyiv summer: UTC+3
    expect(localToUtc("2026-07-04T08:30", "Europe/Kyiv")).toBe("2026-07-04T05:30:00.000Z");
    expect(tzOffsetMinutes(Date.parse("2026-07-04T05:30:00Z"), "Europe/Kyiv")).toBe(180);
    // Western hemisphere
    expect(utcToLocal("2026-11-21T06:30:00.000Z", "America/New_York")).toBe("2026-11-21T01:30");
  });

  it("date arithmetic", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(weekday("2026-11-21")).toBe(6); // Saturday
  });
});

describe("weekends", () => {
  it("finds the next saturday and builds shapes", () => {
    expect(nextSaturday("2026-11-15")).toBe("2026-11-21"); // Sunday -> next Sat
    expect(nextSaturday("2026-11-21")).toBe("2026-11-28"); // Sat -> following Sat
    const w = weekendFromSaturday("2026-11-21", "fri-sun");
    expect(w).toMatchObject({ departDate: "2026-11-20", returnDate: "2026-11-22" });
    expect(upcomingWeekends("2026-11-15", 3).map((x) => x.saturday)).toEqual(["2026-11-21", "2026-11-28", "2026-12-05"]);
  });
});
