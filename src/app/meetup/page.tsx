import { Suspense } from "react";
import { MeetupPage } from "@/components/meetup/MeetupPage";

export default function Page() {
  return (
    <Suspense>
      <MeetupPage />
    </Suspense>
  );
}
