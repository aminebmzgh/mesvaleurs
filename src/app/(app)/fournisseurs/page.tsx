import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Fournisseurs" };

export default function Page() {
  return <ComingSoon title="Fournisseurs" description="Fiches fournisseurs, factures, paiements et solde dû." phase="Phase 1" />;
}
