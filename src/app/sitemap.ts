import type { MetadataRoute } from "next";

export const siteUrl = (process.env.APP_URL ?? "https://remeeet.com").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/explore", "/meetup", "/how-it-works", "/faq", "/privacy", "/terms"];
  return pages.map((p) => ({ url: `${siteUrl}${p}`, changeFrequency: p === "" ? "weekly" : "monthly" }));
}
