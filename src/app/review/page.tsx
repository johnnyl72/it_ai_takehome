import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoading } from "@/components/Access";
import { ApplicationReview } from "@/components/ApplicationReview";

export const metadata: Metadata = { title: "Review an application | Label Check" };

/** `?id=` rather than a route segment, so the site stays static with any number of applications. */
export default function ReviewPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ApplicationReview />
    </Suspense>
  );
}
