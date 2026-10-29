import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate, PageLoading } from "@/components/Access";
import { Team } from "@/components/Team";

export const metadata: Metadata = { title: "Team | Label Check" };

export default function TeamPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Gate anyOf={["team.monitor"]} what="the Team page">
        <Team />
      </Gate>
    </Suspense>
  );
}
