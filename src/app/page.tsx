import { Suspense } from "react";
import { SearchPage } from "@/components/search/SearchPage";

export default function Home() {
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  );
}
