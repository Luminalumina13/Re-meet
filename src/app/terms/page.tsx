import type { Metadata } from "next";
import { LegalView } from "@/components/legal/LegalView";
import { loadLegal } from "@/lib/legal/load";

export const metadata: Metadata = { title: "Умови користування · Terms of Use · Re:meeet" };

export default function Page() {
  return <LegalView docs={loadLegal("terms")} />;
}
