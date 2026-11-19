import { describe, expect, it } from "vitest";
import { alertText } from "@/lib/watch/alertText";
import { uk } from "@/lib/i18n/uk";
import { en } from "@/lib/i18n/en";
import type { Alert } from "@/lib/watch/types";

const base = { id: "1", at: "2026-11-19T10:00:00Z", message: "stored" };
const w = { currency: "EUR", targetPrice: 90 };

describe("alert text", () => {
  it("builds localized text from the structured fields", () => {
    const drop: Alert = { ...base, type: "price_drop", price: 80, previousPrice: 100 };
    expect(alertText(drop, w, uk.watch.alertMsg)).toBe("Ціна впала на 20 %: 100 → 80 EUR");
    expect(alertText(drop, w, en.watch.alertMsg)).toBe("Price dropped 20 %: 100 → 80 EUR");
    expect(alertText({ ...base, type: "target_reached", price: 85 }, w, uk.watch.alertMsg)).toBe("Досягнуто цільову ціну: 85 EUR (ціль 90 EUR)");
    expect(alertText({ ...base, type: "new_offer", count: 2, total: 9 }, w, en.watch.alertMsg)).toBe("New offers: 2 (9 total)");
    expect(alertText({ ...base, type: "no_results" }, w, uk.watch.alertMsg)).toBe("Підходящих пропозицій більше немає");
  });

  it("falls back to the stored message when data is missing", () => {
    expect(alertText({ ...base, type: "price_drop" }, w, uk.watch.alertMsg)).toBe("stored");
  });
});
