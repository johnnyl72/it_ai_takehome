import type { Metadata } from "next";
import { BatchCheck } from "@/components/BatchCheck";

export const metadata: Metadata = { title: "Check a batch | Label Check" };

export default function BatchPage() {
  return <BatchCheck />;
}
