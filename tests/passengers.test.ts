import { describe, expect, it } from "vitest";
import { MockProvider } from "@/lib/providers/mock";
import { exploreRequestSchema, searchRequestSchema } from "@/lib/api/schemas";

const provider = new MockProvider({ volatilitySeed: 1 });
const trip = { origin: "WAW", destination: "BCN", departDate: "2026-11-21", cabin: "economy" as const, currency: "EUR" };

describe("passenger types", () => {
  it("prices children below adults and infants far below", async () => {
    const price = async (adults: number, children = 0, infants = 0) =>
      (await provider.search({ ...trip, adults, children, infants }))[0].price.amount;
    const adult = await price(1);
    const withChild = await price(1, 1);
    const withInfant = await price(1, 0, 1);
    expect(withChild).toBeGreaterThan(adult);
    expect(withChild).toBeLessThan(adult * 2);
    expect(withInfant).toBeGreaterThan(adult);
    expect(withInfant).toBeLessThan(withChild);
  });

  it("defaults children and infants to zero", () => {
    const r = searchRequestSchema.parse({ origin: "WAW", destination: "BCN", departDate: "2026-11-21" });
    expect(r.children).toBe(0);
    expect(r.infants).toBe(0);
  });

  it("requires an adult for every infant and caps the party at nine", () => {
    const req = { origin: "WAW", destination: "BCN", departDate: "2026-11-21" };
    expect(searchRequestSchema.safeParse({ ...req, adults: 1, infants: 2 }).success).toBe(false);
    expect(searchRequestSchema.safeParse({ ...req, adults: 5, children: 4, infants: 1 }).success).toBe(false);
    expect(searchRequestSchema.safeParse({ ...req, adults: 2, children: 2, infants: 1 }).success).toBe(true);
    expect(exploreRequestSchema.safeParse({ origin: "WAW", departDate: "2026-11-21", returnDate: "2026-11-22", adults: 1, infants: 2 }).success).toBe(false);
  });
});
