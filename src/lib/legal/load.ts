import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMarkdown, type Block } from "./markdown";

export type LegalDoc = "privacy" | "terms";
export type LegalLang = "uk" | "en";

interface Company {
  name: string;
  nameEn: string;
  edrpou: string;
  address: string;
  email: string;
  site: string;
  version: string;
  year: string;
  effective: Record<LegalLang, string>;
}

const dir = join(process.cwd(), "content", "legal");

export function loadCompany(): Company {
  return JSON.parse(readFileSync(join(dir, "company.json"), "utf8")) as Company;
}

/** Fills {{placeholders}} from company.json. Unknown placeholders are left visible so they get noticed. */
export function fillPlaceholders(md: string, company: Company, lang: LegalLang): string {
  const values: Record<string, string> = { ...company, effective: company.effective[lang] } as unknown as Record<string, string>;
  return md.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => (typeof values[key] === "string" ? values[key] : whole));
}

export function loadLegalSource(doc: LegalDoc, lang: LegalLang): string {
  return fillPlaceholders(readFileSync(join(dir, `${doc}.${lang}.md`), "utf8"), loadCompany(), lang);
}

/** Both language versions of a document, parsed for rendering. */
export function loadLegal(doc: LegalDoc): Record<LegalLang, Block[]> {
  return { uk: parseMarkdown(loadLegalSource(doc, "uk")), en: parseMarkdown(loadLegalSource(doc, "en")) };
}
