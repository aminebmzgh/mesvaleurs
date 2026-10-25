import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Nouveau paiement" };

export default function Page() {
  return <ComingSoon title="Nouveau paiement" description="Assistant d'émission et d'impression des chèques et LCN." phase="Phase 1" />;
}
