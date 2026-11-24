import { MAX_MEETUP_DESTINATIONS } from "@/lib/meetup/limits";
import { MAX_GROUP_RANGE_DAYS, MAX_NIGHTS, rangeProblem, type DateRange } from "@/lib/domain/dateRange";
import { isSafeWebhookSyntax } from "@/lib/watch/webhook";
import { z } from "zod";

const iata = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "IATA code expected");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD expected");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM expected");

export const timeWindowSchema = z
  .object({
    departAfter: hhmm.optional(),
    departBefore: hhmm.optional(),
    arriveAfter: hhmm.optional(),
    arriveBefore: hhmm.optional(),
  })
  .strict();

export const filtersSchema = z
  .object({
    outbound: timeWindowSchema.optional(),
    inbound: timeWindowSchema.optional(),
    maxStops: z.number().int().min(0).max(3).optional(),
    maxPrice: z.number().positive().optional(),
    carriers: z.array(z.string().length(2)).max(30).optional(),
    maxDurationMin: z.number().int().min(30).max(24 * 60).optional(),
  })
  .strict();

/** Optional flexible dates shared by the group planner and "anywhere". */
const rangeFields = {
  departUntil: isoDate.optional(),
  returnUntil: isoDate.optional(),
  minNights: z.number().int().min(0).max(MAX_NIGHTS).optional(),
  maxNights: z.number().int().min(0).max(MAX_NIGHTS).optional(),
};
const rangeOk = (v: DateRange) => rangeProblem(v, MAX_GROUP_RANGE_DAYS) === null;
const rangeMessage = { message: "Date range is reversed, too long or has no valid pair", path: ["departUntil"] };

export const cabinSchema = z.enum(["economy", "premium_economy", "business", "first"]);

export const searchRequestSchema = z
  .object({
    origin: iata,
    destination: iata,
    departDate: isoDate,
    returnDate: isoDate.optional(),
    adults: z.number().int().min(1).max(9).default(1),
    children: z.number().int().min(0).max(8).default(0),
    infants: z.number().int().min(0).max(4).default(0),
    cabin: cabinSchema.default("economy"),
    currency: z.string().length(3).toUpperCase().default("EUR"),
    filters: filtersSchema.optional(),
  })
  .refine((v) => v.infants <= v.adults, { message: "Each infant needs an adult", path: ["infants"] })
  .refine((v) => v.adults + v.children + v.infants <= 9, { message: "At most 9 passengers", path: ["adults"] })
  .refine((v) => v.origin !== v.destination, { message: "Origin and destination must differ", path: ["destination"] })
  .refine((v) => !v.returnDate || v.returnDate >= v.departDate, { message: "Return before departure", path: ["returnDate"] });

/** One day of the flexible-dates grid: the cheapest one-way fare on `date`. */
export const flexDaySchema = z.object({
  origin: iata,
  destination: iata,
  date: isoDate,
  /** Which window of the time filters applies: the outbound one or the inbound (return) one. */
  direction: z.enum(["outbound", "inbound"]).default("outbound"),
  adults: z.number().int().min(1).max(9).default(1),
  children: z.number().int().min(0).max(8).default(0),
  infants: z.number().int().min(0).max(4).default(0),
  cabin: cabinSchema.default("economy"),
  currency: z.string().length(3).toUpperCase().default("EUR"),
  filters: filtersSchema.optional(),
});

export const friendSchema = z.preprocess(
  // Accept the old single-airport shape (saved watches) and normalise it.
  (v) => (v && typeof v === "object" && "origin" in v && !("origins" in v) ? { ...v, origins: [(v as { origin: unknown }).origin] } : v),
  z.object({
    id: z.string().min(1).max(40),
    name: z.string().trim().min(1).max(40),
    origins: z
      .array(iata)
      .min(1)
      .max(4)
      .transform((a) => [...new Set(a)]),
  }),
);

export const meetupRequestSchema = z
  .object({
    friends: z.array(friendSchema).min(2).max(8),
    destinations: z.array(iata).min(1).max(MAX_MEETUP_DESTINATIONS),
    departDate: isoDate,
    returnDate: isoDate,
    cabin: cabinSchema.default("economy"),
    currency: z.string().length(3).toUpperCase().default("EUR"),
    filters: filtersSchema.optional(),
    valuePerHour: z.number().min(0).max(1000).default(15),
    maxBudgetPerPerson: z.number().positive().optional(),
    minTogetherHours: z.number().min(0).max(240).optional(),
    topK: z.number().int().min(1).max(20).optional(),
    ...rangeFields,
  })
  .refine((v) => v.returnDate >= v.departDate, { message: "Return before departure", path: ["returnDate"] })
  .refine(rangeOk, rangeMessage);

export const exploreRequestSchema = z
  .object({
    origin: iata,
    /** Extra departure airports; `origin` is always searched too. */
    origins: z
      .array(iata)
      .max(4)
      .optional()
      .transform((a) => (a?.length ? [...new Set(a)] : undefined)),
    departDate: isoDate,
    returnDate: isoDate,
    ...rangeFields,
    adults: z.number().int().min(1).max(9).default(1),
    children: z.number().int().min(0).max(8).default(0),
    infants: z.number().int().min(0).max(4).default(0),
    cabin: cabinSchema.default("economy"),
    currency: z.string().length(3).toUpperCase().default("EUR"),
    maxFlightHours: z.number().min(1).max(16).default(4),
    filters: filtersSchema.optional(),
  })
  .refine((v) => v.infants <= v.adults, { message: "Each infant needs an adult", path: ["infants"] })
  .refine((v) => v.adults + v.children + v.infants <= 9, { message: "At most 9 passengers", path: ["adults"] })
  .refine((v) => v.returnDate >= v.departDate, { message: "Return before departure", path: ["returnDate"] })
  .refine(rangeOk, rangeMessage);

export const watchCreateSchema = z.object({
  label: z.string().trim().min(1).max(120),
  params: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("search"), request: searchRequestSchema }),
    z.object({ kind: z.literal("meetup"), request: meetupRequestSchema }),
    z.object({ kind: z.literal("explore"), request: exploreRequestSchema }),
  ]),
  targetPrice: z.number().positive().optional(),
  dropThreshold: z.number().min(0.01).max(0.9).optional(),
  notify: z
    .object({
      webhookUrl: z.string().url().max(500).refine(isSafeWebhookSyntax, "Webhook must be a public http(s) URL").optional(),
      telegramChatId: z.string().max(40).optional(),
    })
    .optional(),
});

export const watchPatchSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  active: z.boolean().optional(),
  targetPrice: z.number().positive().nullable().optional(),
  dropThreshold: z.number().min(0.01).max(0.9).optional(),
  notify: z
    .object({
      webhookUrl: z.string().url().max(500).refine(isSafeWebhookSyntax, "Webhook must be a public http(s) URL").nullable().optional(),
      telegramChatId: z.string().max(40).optional(),
    })
    .optional(),
});

export type FlexDayInput = z.input<typeof flexDaySchema>;
export type SearchRequestInput = z.input<typeof searchRequestSchema>;
export type MeetupRequestInput = z.input<typeof meetupRequestSchema>;
export type WatchCreateInput = z.input<typeof watchCreateSchema>;
export type ExploreRequestInput = z.input<typeof exploreRequestSchema>;
