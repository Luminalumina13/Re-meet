import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { readFileSync } from "node:fs";
import { howto, imageSize } from "@/content/howto";

/** Width and height from the JPEG start-of-frame marker. */
function jpegSize(path: string): [number, number] {
  const b = readFileSync(path);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) throw new Error("bad jpeg");
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error("no size");
}

describe("how it works and FAQ content", () => {
  it("has the same structure in Ukrainian and English", () => {
    expect(howto.uk.steps.map((s) => s.id)).toEqual(howto.en.steps.map((s) => s.id));
    expect(howto.uk.steps.map((s) => s.image)).toEqual(howto.en.steps.map((s) => s.image));
    expect(howto.uk.tips.items).toHaveLength(howto.en.tips.items.length);
    expect(howto.uk.faq.items).toHaveLength(howto.en.faq.items.length);
    expect(Object.keys(howto.uk.form)).toEqual(Object.keys(howto.en.form));
  });

  it("never mentions webhooks or shows an email address", () => {
    const all = JSON.stringify(howto).toLowerCase();
    expect(all).not.toMatch(/webhook|вебхук/);
    expect(all).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it("gives every screenshot an alt text", () => {
    for (const lang of ["uk", "en"] as const) for (const s of howto[lang].steps) if (s.image) expect(s.alt.length).toBeGreaterThan(10);
  });

  it("lists the pages in the sitemap and keeps crawlers out of the API", () => {
    const urls = sitemap().map((x) => x.url);
    expect(urls).toContain("https://remeeet.com/how-it-works");
    expect(urls).toContain("https://remeeet.com/faq");
    const r = robots();
    expect(r.sitemap).toBe("https://remeeet.com/sitemap.xml");
    expect(JSON.stringify(r.rules)).toContain("/api/");
  });

  it("declares the real size of every screenshot so the page does not jump while images load", () => {
    for (const s of howto.uk.steps) {
      if (!s.image) continue;
      expect(imageSize[s.image], s.image).toBeDefined();
      expect(jpegSize(`public${s.image}`), s.image).toEqual(imageSize[s.image]);
    }
  });
});
