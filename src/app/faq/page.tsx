import type { Metadata } from "next";
import { Faq } from "@/components/info/Faq";
import { howto } from "@/content/howto";

export const metadata: Metadata = {
  title: "Питання й відповіді · FAQ · Re:meeet",
  description: "Відповіді на поширені питання про Re:meeet: ціни, відстеження, Telegram, планувач зустрічей. Answers to common questions about Re:meeet.",
  alternates: { canonical: "/faq" },
};

// Structured data for search engines, in the page's default language.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: howto.uk.faq.items.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })),
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Faq />
    </>
  );
}
