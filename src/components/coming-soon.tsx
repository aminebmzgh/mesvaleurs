import { ConstructionIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

/** Page d'un module prévu dans une phase ultérieure. */
export function ComingSoon({ title, description, phase }: { title: string; description: string; phase: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={ConstructionIcon}
        title="Module en préparation"
        description={`Cet écran sera disponible en ${phase}. Les données de démonstration sont déjà en base.`}
      />
    </>
  );
}
