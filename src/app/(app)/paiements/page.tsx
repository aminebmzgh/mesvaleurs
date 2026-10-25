import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Chèques et LCN" };

export default function Page() {
  return <ComingSoon title="Chèques et LCN" description="Suivi des chèques et LCN émis, remis, débités ou annulés." phase="Phase 1" />;
}
