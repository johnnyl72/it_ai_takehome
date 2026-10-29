import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate, PageLoading } from "@/components/Access";
import { BatchCheck } from "@/components/BatchCheck";

export const metadata: Metadata = { title: "Check a batch | Label Check" };

export default function BatchPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Gate anyOf={["check.batch"]} what="batch checks">
        <BatchCheck />
      </Gate>
    </Suspense>
  );
}
