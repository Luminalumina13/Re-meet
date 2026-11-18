import { describe, expect, it } from "vitest";
import { adsenseMeta } from "@/lib/adsenseMeta";

describe("AdSense verification meta tag", () => {
  it("is emitted for a valid client id", () => {
    expect(adsenseMeta("ca-pub-6087952058403503")).toEqual({ other: { "google-adsense-account": "ca-pub-6087952058403503" } });
  });

  it("is absent without an id or with a malformed one", () => {
    expect(adsenseMeta(undefined)).toEqual({});
    expect(adsenseMeta("")).toEqual({});
    expect(adsenseMeta('ca-pub-1"><script>')).toEqual({});
    expect(adsenseMeta("pub-123")).toEqual({});
  });
});
