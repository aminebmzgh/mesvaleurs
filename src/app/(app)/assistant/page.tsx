import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getAiStatus } from "@/lib/ai/usage";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AssistantChat } from "./assistant-chat";

export const metadata: Metadata = { title: "Assistant IA" };

export default function AssistantPage() {
  return (
    <>
      <PageHeader
        title="Assistant IA"
        description="Questions en français sur vos fournisseurs, factures, chèques, LCN, délais de paiement et trésorerie : réponses tirées de vos données, avec les liens vers les écrans."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-3xl rounded-xl" />}>
        <Assistant />
      </Suspense>
    </>
  );
}

async function Assistant() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const ai = await getAiStatus(supabase, organization.organizationId);
  if (!ai.configured) {
    return <p className="text-sm text-muted-foreground">L&apos;assistant IA n&apos;est pas disponible sur ce serveur.</p>;
  }
  if (!ai.enabled) {
    return (
      <p className="text-sm text-muted-foreground">
        L&apos;IA est désactivée pour votre entreprise.{" "}
        {organization.role === "admin" ? (
          <Link href="/parametres/organisation#ia" className="underline">
            L&apos;activer dans les paramètres
          </Link>
        ) : (
          "Un administrateur peut l'activer dans les paramètres."
        )}
      </p>
    );
  }
  return <AssistantChat key={organization.organizationId} quota={ai.quota} used={ai.used} />;
}
