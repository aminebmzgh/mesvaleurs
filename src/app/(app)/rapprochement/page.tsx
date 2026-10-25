import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Rapprochement bancaire" };

export default function Page() {
  return <ComingSoon title="Rapprochement bancaire" description="Import des relevés et rapprochement avec les paiements émis." phase="Phase 1" />;
}
