import type { Metadata } from "next";
import { Suspense } from "react";
import { ExplorePage } from "@/components/explore/ExplorePage";

export const metadata: Metadata = {
  title: 'Куди полетіти · Anywhere · Re:meeet',
  description: 'Не знаєте, куди їхати? Покажемо найдешевші напрямки з вашого міста на вихідні чи будь-які дати. Not sure where to go? See the cheapest destinations from your city.',
  alternates: { canonical: '/explore' },
  openGraph: { title: 'Куди полетіти · Anywhere · Re:meeet', description: 'Не знаєте, куди їхати? Покажемо найдешевші напрямки з вашого міста на вихідні чи будь-які дати. Not sure where to go? See the cheapest destinations from your city.', url: '/explore' },
};

export default function Page() {
  return (
    <Suspense>
      <ExplorePage />
    </Suspense>
  );
}
