import { ApiError } from "@/lib/client";
import type { Dict } from "@/lib/i18n/uk";

/** Server validation messages (English, stable) → localized field texts. */
const FIELD_MESSAGES: Record<string, keyof Dict["errors"]["fields"]> = {
  "Each infant needs an adult": "infants",
  "At most 9 passengers": "passengers",
  "Origin and destination must differ": "sameRoute",
  "Return before departure": "returnDate",
  "Webhook must be a public http(s) URL": "webhook",
};

/** A user-facing, localized message for anything thrown by `api()`. */
export function errorText(e: unknown, t: Dict): string {
  if (!(e instanceof ApiError)) return t.errors.unknown;
  switch (e.code) {
    case "network":
      return t.errors.network;
    case "timeout":
      return t.errors.timeout;
    case "bad_json":
      return t.errors.badJson;
    case "not_found":
      return t.errors.notFound;
    case "unauthorized":
      return t.errors.unauthorized;
    case "unavailable":
      return t.errors.unavailable;
    case "rate_limited":
      return t.errors.rateLimited;
    case "internal":
      return t.errors.internal;
    case "invalid_request": {
      const known = e.issues?.map((i) => FIELD_MESSAGES[i.message]).find(Boolean);
      return known ? t.errors.fields[known] : t.errors.invalid;
    }
    default:
      return e.status >= 500 ? t.errors.internal : t.errors.unknown;
  }
}
