import type { Metadata } from "next";
import { Suspense } from "react";
import { MeetupPage } from "@/components/meetup/MeetupPage";

export const metadata: Metadata = {
  title: 'Зустріч друзів · Meet-up planner · Re:meeet',
  description: 'Друзі живуть у різних містах? Знайдемо місце й дати, куди всім вигідно долетіти. Friends in different cities? Find a place and dates that work for everyone.',
  alternates: { canonical: '/meetup' },
  openGraph: { title: 'Зустріч друзів · Meet-up planner · Re:meeet', description: 'Друзі живуть у різних містах? Знайдемо місце й дати, куди всім вигідно долетіти. Friends in different cities? Find a place and dates that work for everyone.', url: '/meetup' },
};

export default function Page() {
  return (
    <Suspense>
      <MeetupPage />
    </Suspense>
  );
}
