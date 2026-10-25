import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Factures" };

export default function Page() {
  return <ComingSoon title="Factures" description="Factures fournisseurs, reste dû et statut de règlement." phase="Phase 1" />;
}
