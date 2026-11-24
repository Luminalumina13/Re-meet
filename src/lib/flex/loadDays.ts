import type { FlexDayResult } from "./day";
import { postJson } from "@/lib/client";

export type DayEntry = FlexDayResult | "error";
export type Direction = "outbound" | "inbound";

export interface DayJob {
  date: string;
  dir: Direction;
}

export interface DayBase {
  origin: string;
  destination: string;
  adults: number;
  children: number;
  infants: number;
  cabin: string;
  currency: string;
  filters: unknown;
}

export const dayKey = (dir: Direction, date: string) => `${dir}:${date}`;

/** Cheapest one-way fare per day, a few requests at a time; each answer is reported as it arrives. */
export async function loadDays(jobs: DayJob[], base: DayBase, signal: AbortSignal, onEntry: (key: string, entry: DayEntry) => void, concurrency = 4): Promise<void> {
  const { origin, destination, ...rest } = base;
  let next = 0;
  const worker = async () => {
    while (next < jobs.length && !signal.aborted) {
      const { date, dir } = jobs[next++];
      const [from, to] = dir === "outbound" ? [origin, destination] : [destination, origin];
      let entry: DayEntry;
      try {
        entry = await postJson<FlexDayResult>("/api/flex", { ...rest, origin: from, destination: to, date, direction: dir });
      } catch {
        entry = "error";
      }
      if (!signal.aborted) onEntry(dayKey(dir, date), entry);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}
