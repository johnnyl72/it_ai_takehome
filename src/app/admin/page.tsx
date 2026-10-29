import type { Metadata } from "next";
import { Suspense } from "react";
import { Gate, PageLoading } from "@/components/Access";
import { Admin } from "@/components/Admin";

export const metadata: Metadata = { title: "Admin | Label Check" };

export default function AdminPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Gate anyOf={["admin", "system.health"]} what="the Admin page">
        <Admin />
      </Gate>
    </Suspense>
  );
}
