import { Suspense } from "react";
import { PageLoading } from "@/components/Access";
import { Queue } from "@/components/Queue";

export default function Home() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Queue />
    </Suspense>
  );
}
