import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseInline, parseMarkdown } from "@/lib/legal/markdown";
import { fillPlaceholders, loadCompany, loadLegal, loadLegalSource, type LegalDoc, type LegalLang } from "@/lib/legal/load";

const DOCS: LegalDoc[] = ["privacy", "terms"];
const LANGS: LegalLang[] = ["uk", "en"];

describe("markdown subset", () => {
  it("parses headings, paragraphs and lists", () => {
    const b = parseMarkdown("# Title\n\nMeta line\n\n## 1. First\n\nText one\ncontinues.\n\n- a\n- b\n\n### 1.1. Sub\n\nEnd");
    expect(b.map((x) => x.type)).toEqual(["h1", "p", "h2", "p", "ul", "h3", "p"]);
    expect(b[2]).toMatchObject({ type: "h2", id: "s1" });
    expect(b[3]).toMatchObject({ type: "p", inline: [{ t: "text", v: "Text one continues." }] });
    expect(b[4]).toMatchObject({ type: "ul" });
    expect((b[4] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("renders bold, safe links and placeholders, and refuses unsafe links", () => {
    expect(parseInline("a **b** [Terms](/terms) [Site](https://example.com) [Mail](mailto:a@b.co)")).toEqual([
      { t: "text", v: "a " },
      { t: "b", v: "b" },
      { t: "text", v: " " },
      { t: "a", v: "Terms", href: "/terms" },
      { t: "text", v: " " },
      { t: "a", v: "Site", href: "https://example.com" },
      { t: "text", v: " " },
      { t: "a", v: "Mail", href: "mailto:a@b.co" },
    ]);
    // an unsafe address never becomes a link: only its text is kept
    expect(parseInline("[x](javascript:alert(1))").some((t) => t.t === "a")).toBe(false);
    expect(parseInline("[x](javascript:alert(1))")[0]).toEqual({ t: "text", v: "x" });
    expect(parseInline("[x](//evil.example)")[0]).toEqual({ t: "text", v: "x" });
    expect(parseInline("code [вкажіть ЄДРПОУ] end")[1]).toEqual({ t: "todo", v: "[вкажіть ЄДРПОУ]" });
  });
});

describe("legal documents", () => {
  const company = loadCompany();
  const keys = new Set(Object.keys(company).concat("effective"));

  it("belong to the sole proprietor", () => {
    expect(company.name).toBe("ФОП Павленко Світлана Сергіївна");
    for (const doc of DOCS) {
      expect(loadLegalSource(doc, "uk")).toContain("ФОП Павленко Світлана Сергіївна");
      expect(loadLegalSource(doc, "en")).toContain("Pavlenko");
    }
    expect(loadLegalSource("terms", "uk")).toContain("Усі права захищено");
    expect(loadLegalSource("terms", "en")).toContain("All rights reserved");
  });

  it("have every {{placeholder}} defined and none left after filling", () => {
    for (const doc of DOCS)
      for (const lang of LANGS) {
        const raw = readFileSync(join(process.cwd(), "content", "legal", `${doc}.${lang}.md`), "utf8");
        for (const m of raw.matchAll(/\{\{(\w+)\}\}/g)) expect(keys.has(m[1]), `${doc}.${lang}: {{${m[1]}}}`).toBe(true);
        expect(fillPlaceholders(raw, company, lang)).not.toMatch(/\{\{/);
      }
  });

  it("have matching structure in both languages", () => {
    for (const doc of DOCS) {
      const d = loadLegal(doc);
      const headings = (l: LegalLang) => d[l].filter((b) => b.type === "h2").length;
      expect(headings("uk")).toBeGreaterThanOrEqual(10);
      expect(headings("uk")).toBe(headings("en"));
      expect(d.uk.filter((b) => b.type === "h3").length).toBe(d.en.filter((b) => b.type === "h3").length);
      expect(d.uk[0].type).toBe("h1");
      expect(d.en[0].type).toBe("h1");
    }
  });

  it("number their sections in order", () => {
    for (const doc of DOCS)
      for (const lang of LANGS) {
        const titles = loadLegal(doc)[lang].filter((b): b is { type: "h2"; text: string; id: string } => b.type === "h2").map((b) => b.text);
        titles.forEach((t, i) => expect(t.startsWith(`${i + 1}. `), `${doc}.${lang}: "${t}"`).toBe(true));
      }
  });

  it("link to each other with site paths only", () => {
    const links = (doc: LegalDoc, lang: LegalLang) => {
      const out: string[] = [];
      for (const b of loadLegal(doc)[lang]) {
        const inl = b.type === "p" ? b.inline : b.type === "ul" ? b.items.flat() : [];
        for (const x of inl) if (x.t === "a") out.push(x.href);
      }
      return out;
    };
    for (const lang of LANGS) {
      expect(links("privacy", lang)).toContain("/terms");
      expect(links("terms", lang)).toContain("/privacy");
    }
  });

  it("state the facts the product relies on", () => {
    const text = loadLegalSource("privacy", "en");
    // analytics and ads only with consent, names stay local, providers named, Telegram covered, retention given
    expect(text).toMatch(/Without your consent we do not set analytics or advertising cookies/);
    expect(text).toContain("Google Analytics");
    expect(text).toContain("Google AdSense");
    expect(text).toMatch(/Friends' names are not sent/);
    for (const name of ["Kiwi.com", "lastminute.com", "Ryanair", "Telegram"]) expect(text).toContain(name);
    expect(text).toMatch(/up to 10 minutes/);
    expect(text).toMatch(/Ukrainian Parliament Commissioner for Human Rights/);
    const terms = loadLegalSource("terms", "en");
    expect(terms).toMatch(/not a ticket seller/);
    expect(terms).toMatch(/laws of Ukraine/);
  });
});
