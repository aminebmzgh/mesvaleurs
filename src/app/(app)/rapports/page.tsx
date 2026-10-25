import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Rapports" };

export default function Page() {
  return <ComingSoon title="Rapports" description="Rapport de fin de mois : payés, en circulation, anomalies." phase="Phase 1" />;
}
