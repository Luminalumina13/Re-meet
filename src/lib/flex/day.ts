import { forBags, type Itinerary, type SearchRequest } from "@/lib/domain/types";
import { fetchRaw, type AggregateOptions } from "@/lib/providers/aggregator";
import { matchesOneWay, oneWayFilters } from "@/lib/meetup/engine";

/** One candidate fare for the day. Times are absolute so pairs can be checked for feasibility. */
export interface FlexOption {
  price: number;
  departUtc: string;
  arriveUtc: string;
  departLocal: string;
  providerName: string;
}

export interface FlexDayResult {
  date: string;
  /** Cheapest matching one-way fare for the whole party, null when nothing fits the filters. */
  price: number | null;
  currency: string;
  count: number;
  /** Departure time (local) of the cheapest option, for the tooltip. */
  departLocal?: string;
  providerName?: string;
  /**
   * Fares worth pairing: not beaten by another that is cheaper and also better for the trip (arrives
   * earlier going out, leaves later coming back). Cheapest first.
   */
  options: FlexOption[];
  /** Some sources failed, so a missing price may only mean "unknown". */
  partial: boolean;
}

/** Cheapest one-way fare on one day, honouring the time-of-day window and the other filters. */
export async function flexDay(
  req: Pick<SearchRequest, "origin" | "destination" | "adults" | "children" | "infants" | "cabin" | "currency" | "filters"> & { date: string; direction: "outbound" | "inbound" },
  opts: AggregateOptions = {},
): Promise<FlexDayResult> {
  const filters = oneWayFilters(req.filters, req.direction);
  const search: SearchRequest = {
    origin: req.origin,
    destination: req.destination,
    departDate: req.date,
    adults: req.adults,
    children: req.children,
    infants: req.infants,
    cabin: req.cabin,
    currency: req.currency,
    filters,
    quick: true,
  };
  const { raw, providers } = await fetchRaw(search, opts);
  const fits = forBags(raw.filter((it) => matchesOneWay(it, filters)), filters?.bags);
  const best = fits.reduce<(typeof fits)[number] | null>((b, it) => (!b || it.price.amount < b.price.amount ? it : b), null);
  return {
    options: paretoOptions(fits, req.direction),
    date: req.date,
    price: best ? Math.round(best.price.amount) : null,
    currency: req.currency,
    count: fits.length,
    departLocal: best?.legs[0].departLocal,
    providerName: best?.providerName,
    partial: providers.some((p) => p.status === "error"),
  };
}

const MAX_OPTIONS = 8;

/**
 * Keeps each fare only if no cheaper-or-equal one is also better for the trip: outbound flights
 * should arrive early, return flights should leave late. A cheap flight that arrives after the
 * cheap return has left is useless alone, but a dearer, earlier one can make the pair work.
 */
export function paretoOptions(list: Itinerary[], direction: "outbound" | "inbound"): FlexOption[] {
  const sorted = [...list].sort((a, b) => a.price.amount - b.price.amount);
  const out: FlexOption[] = [];
  let bestArrive = Infinity;
  let bestDepart = -Infinity;
  for (const it of sorted) {
    const leg = it.legs[0];
    const arrive = Date.parse(leg.arriveUtc);
    const depart = Date.parse(leg.departUtc);
    const better = direction === "outbound" ? arrive < bestArrive : depart > bestDepart;
    if (!better) continue;
    bestArrive = Math.min(bestArrive, arrive);
    bestDepart = Math.max(bestDepart, depart);
    out.push({ price: it.price.amount, departUtc: leg.departUtc, arriveUtc: leg.arriveUtc, departLocal: leg.departLocal, providerName: it.providerName });
    if (out.length >= MAX_OPTIONS) break;
  }
  return out;
}
