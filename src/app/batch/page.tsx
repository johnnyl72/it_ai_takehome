import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate, PageLoading } from "@/components/Access";
import { OwnLabelsNav } from "@/components/OwnLabels";
import { BatchCheck } from "@/components/BatchCheck";

export const metadata: Metadata = { title: "Your own labels: a batch | Label Check" };

export default function BatchPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Gate anyOf={["check.batch"]} what="batch checks">
        <OwnLabelsNav current="batch" />
        <BatchCheck />
      </Gate>
    </Suspense>
  );
}
