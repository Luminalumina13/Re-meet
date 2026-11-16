import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/client";
import { errorText } from "@/lib/errorText";
import { badRequest, serverError } from "@/lib/api/respond";
import { en } from "@/lib/i18n/en";
import { uk } from "@/lib/i18n/uk";

describe("error texts", () => {
  it("maps codes to localized text", () => {
    expect(errorText(new ApiError("network", 0, undefined, "network"), uk)).toBe(uk.errors.network);
    expect(errorText(new ApiError("x", 404, undefined, "not_found"), en)).toBe(en.errors.notFound);
    expect(errorText(new ApiError("x", 502), en)).toBe(en.errors.internal);
    expect(errorText(new Error("boom"), uk)).toBe(uk.errors.unknown);
  });
  it("explains known validation problems and falls back to a generic one", () => {
    const known = new ApiError("x", 400, [{ path: ["infants"], message: "Each infant needs an adult" }], "invalid_request");
    expect(errorText(known, en)).toBe(en.errors.fields.infants);
    const other = new ApiError("x", 400, [{ path: ["a"], message: "Required" }], "invalid_request");
    expect(errorText(other, uk)).toBe(uk.errors.invalid);
  });
  it("API responses carry a code and never internal text", async () => {
    const r = serverError(new Error("secret db path"));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "internal", code: "internal" });
    expect((await badRequest("Body must be JSON").json()).code).toBe("bad_json");
  });
});
