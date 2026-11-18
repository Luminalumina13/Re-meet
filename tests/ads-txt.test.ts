import { afterEach, describe, expect, it, vi } from "vitest";

describe("ads.txt", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is 404 without an AdSense id and lists the publisher with one", async () => {
    const { GET } = await import("@/app/ads.txt/route");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "");
    expect(GET().status).toBe(404);
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-1234567890123456");
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0\n");
  });

  it("rejects malformed ids", async () => {
    const { GET } = await import("@/app/ads.txt/route");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-12; rm -rf");
    expect(GET().status).toBe(404);
  });
});
