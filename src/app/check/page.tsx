import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate, PageLoading } from "@/components/Access";
import { OwnLabelsNav } from "@/components/OwnLabels";
import { SingleCheck } from "@/components/SingleCheck";

export const metadata: Metadata = { title: "Your own labels | Label Check" };

export default function CheckPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Gate anyOf={["check.single"]} what="checking a single label">
        <OwnLabelsNav current="check" />
        <SingleCheck />
      </Gate>
    </Suspense>
  );
}
