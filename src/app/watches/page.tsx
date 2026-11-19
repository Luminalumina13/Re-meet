import { Suspense } from "react";
import { WatchesPage } from "@/components/watch/WatchesPage";

export default function Page() {
  return (
    <Suspense>
      <WatchesPage />
    </Suspense>
  );
}
