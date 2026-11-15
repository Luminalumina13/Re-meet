import type { SearchRequest } from "@/lib/domain/types";
import { fetchRaw, type AggregateOptions } from "@/lib/providers/aggregator";
import { matchesOneWay, oneWayFilters } from "@/lib/meetup/engine";

export interface FlexDayResult {
  date: string;
  /** Cheapest matching one-way fare for the whole party, null when nothing fits the filters. */
  price: number | null;
  currency: string;
  count: number;
  /** Departure time (local) of the cheapest option, for the tooltip. */
  departLocal?: string;
  providerName?: string;
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
  };
  const { raw, providers } = await fetchRaw(search, opts);
  const fits = raw.filter((it) => matchesOneWay(it, filters));
  const best = fits.reduce<(typeof fits)[number] | null>((b, it) => (!b || it.price.amount < b.price.amount ? it : b), null);
  return {
    date: req.date,
    price: best ? Math.round(best.price.amount) : null,
    currency: req.currency,
    count: fits.length,
    departLocal: best?.legs[0].departLocal,
    providerName: best?.providerName,
    partial: providers.some((p) => p.status === "error"),
  };
}
