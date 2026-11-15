import { Suspense } from "react";
import { ExplorePage } from "@/components/explore/ExplorePage";

export default function Page() {
  return (
    <Suspense>
      <ExplorePage />
    </Suspense>
  );
}
