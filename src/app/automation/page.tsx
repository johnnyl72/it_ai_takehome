import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate, PageLoading } from "@/components/Access";
import { Automation } from "@/components/Automation";

export const metadata: Metadata = { title: "Automatic checks | Label Check" };

export default function AutomationPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Gate anyOf={["automation.view"]} what="the automatic checks">
        <Automation />
      </Gate>
    </Suspense>
  );
}
