import { addDays, weekday } from "./time";

export type WeekendShape = "sat-sun" | "fri-sun" | "sat-mon" | "fri-mon" | "thu-sun";

export interface WeekendOption {
  /** Saturday of the weekend, YYYY-MM-DD (anchor) */
  saturday: string;
  departDate: string;
  returnDate: string;
  shape: WeekendShape;
}

const SHAPES: Record<WeekendShape, { out: number; back: number }> = {
  // offsets relative to Saturday
  "sat-sun": { out: 0, back: 1 },
  "fri-sun": { out: -1, back: 1 },
  "sat-mon": { out: 0, back: 2 },
  "fri-mon": { out: -1, back: 2 },
  "thu-sun": { out: -2, back: 1 },
};

/** Next Saturday strictly after `from` (YYYY-MM-DD). */
export function nextSaturday(from: string): string {
  const wd = weekday(from);
  const delta = (6 - wd + 7) % 7 || 7;
  return addDays(from, delta);
}

export function weekendFromSaturday(saturday: string, shape: WeekendShape): WeekendOption {
  const s = SHAPES[shape];
  return {
    saturday,
    shape,
    departDate: addDays(saturday, s.out),
    returnDate: addDays(saturday, s.back),
  };
}

/** Upcoming weekends starting after `today`. */
export function upcomingWeekends(today: string, count = 8, shape: WeekendShape = "sat-sun"): WeekendOption[] {
  const out: WeekendOption[] = [];
  let sat = nextSaturday(today);
  for (let i = 0; i < count; i++) {
    out.push(weekendFromSaturday(sat, shape));
    sat = addDays(sat, 7);
  }
  return out;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
