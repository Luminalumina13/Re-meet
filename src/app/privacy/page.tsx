import type { Metadata } from "next";
import { LegalView } from "@/components/legal/LegalView";
import { loadLegal } from "@/lib/legal/load";

export const metadata: Metadata = { title: "Політика конфіденційності · Privacy Policy · Re:meeet" };

export default function Page() {
  return <LegalView docs={loadLegal("privacy")} />;
}
