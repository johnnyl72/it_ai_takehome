import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate, PageLoading } from "@/components/Access";
import { SingleCheck } from "@/components/SingleCheck";

export const metadata: Metadata = { title: "Check a label | Label Check" };

export default function CheckPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Gate anyOf={["check.single"]} what="checking a single label">
        <SingleCheck />
      </Gate>
    </Suspense>
  );
}
