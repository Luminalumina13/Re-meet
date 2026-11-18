import type { Metadata } from "next";
import { HowItWorks } from "@/components/info/Steps";

export const metadata: Metadata = {
  title: "Як це працює · How it works · Re:meeet",
  description: "Як шукати квитки на вихідні, порівнювати варіанти, планувати зустріч із друзями та відстежувати ціни в Re:meeet. How to search weekend flights, plan a meetup with friends and track prices.",
  alternates: { canonical: "/how-it-works" },
};

export default function Page() {
  return <HowItWorks />;
}
