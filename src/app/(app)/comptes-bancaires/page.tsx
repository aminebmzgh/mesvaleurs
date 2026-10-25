import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Comptes et chéquiers" };

export default function Page() {
  return <ComingSoon title="Comptes et chéquiers" description="Comptes bancaires, chéquiers, carnets de LCN et modèles d'impression." phase="Phase 1" />;
}
