"use client";

import { useAutomation } from "@/lib/client/automation";
import { useDemo } from "@/lib/client/demo";

/** Keeps the automatic checks running on every page, whoever is signed in. */
export function AutomationRunner() {
  useAutomation(useDemo().automation.running);
  return null;
}
