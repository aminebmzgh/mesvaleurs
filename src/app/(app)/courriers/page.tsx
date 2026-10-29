import { FileTextIcon, MailIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { addDays, todayIso } from "@/lib/dates";
import { templateOptions } from "@/lib/letters/queries";
import { LETTER_KIND_DESCRIPTIONS, LETTER_KIND_LABELS, type LetterKind } from "@/lib/letters/templates";

export const metadata: Metadata = { title: "Courriers types" };

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

/** Où générer chaque courrier : il est pré-rempli depuis l'écran concerné. */
const WHERE: Record<LetterKind, { href: string; label: string } | null> = {
  cover_letter: { href: "/paiements", label: "Chèques et LCN" },
  opposition: { href: "/comptes-bancaires", label: "Comptes et chéquiers" },
  postponement_request: { href: "/paiements?type=lcn", label: "LCN en circulation" },
  statement_request: { href: "/fournisseurs", label: "Fournisseurs" },
  reminder: null,
};

export default function LettersLibraryPage() {
  return (
    <>
      <PageHeader
        title="Courriers types"
        description="Lettres pré-remplies avec l'en-tête de votre entreprise, générées en PDF depuis l'écran concerné."
      />
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <Library />
      </Suspense>
    </>
  );
}

async function Library() {
  const organization = await requireActiveOrganization();
  const canManage = ACCOUNT_MANAGER_ROLES.includes(organization.role);
  const reminderTemplates = await templateOptions("reminder");
  const today = todayIso();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Bibliothèque</CardTitle>
          <CardDescription>
            {canManage ? (
              <>
                Adaptez les textes dans <Link href="/parametres/lettres" className="underline">Modèles de lettres</Link>.
              </>
            ) : (
              "Un administrateur ou un gestionnaire peut adapter les textes."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(Object.keys(LETTER_KIND_LABELS) as LetterKind[]).map((kind) => (
            <div key={kind} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span className="flex min-w-0 flex-col">
                <span className="font-medium">{LETTER_KIND_LABELS[kind]}</span>
                <span className="text-xs text-muted-foreground">{LETTER_KIND_DESCRIPTIONS[kind]}</span>
              </span>
              {WHERE[kind] && (
                <Link href={WHERE[kind].href} className={buttonVariants({ variant: "ghost", size: "sm", className: "shrink-0" })}>
                  {WHERE[kind].label}
                </Link>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailIcon className="size-4" aria-hidden />
            Lettre de relance d&apos;un client
          </CardTitle>
          <CardDescription>Saisie libre, en attendant le suivi des encaissements clients.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/courriers/relance" method="get" target="_blank">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="customer">Client</FieldLabel>
                <Input id="customer" name="customer" required maxLength={200} />
              </Field>
              <Field>
                <FieldLabel htmlFor="address">Adresse (facultatif)</FieldLabel>
                <Textarea id="address" name="address" rows={2} maxLength={300} placeholder={"12, rue Ibn Sina\nRabat"} />
              </Field>
              <Field>
                <FieldLabel htmlFor="invoices">Factures concernées</FieldLabel>
                <Input id="invoices" name="invoices" required maxLength={200} placeholder="la facture n° V-2026-114 du 15/09/2026" />
                <FieldDescription>Reprise telle quelle dans la phrase « nous restons dans l&apos;attente du règlement de … ».</FieldDescription>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="amount">Montant restant dû (DH)</FieldLabel>
                  <Input id="amount" name="amount" required inputMode="decimal" placeholder="12 000,00" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="deadline">À régler au plus tard le</FieldLabel>
                  <Input id="deadline" name="deadline" type="date" required min={today} defaultValue={addDays(today, 8)} />
                </Field>
              </div>
              {reminderTemplates.length > 1 && (
                <Field>
                  <FieldLabel htmlFor="modele">Modèle</FieldLabel>
                  <select id="modele" name="modele" className={SELECT_CLASS} defaultValue={reminderTemplates[0].key}>
                    {reminderTemplates.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.name}
                        {t.custom ? "" : " (intégré)"}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="flex justify-end">
                <button type="submit" className={buttonVariants()}>
                  <FileTextIcon aria-hidden />
                  Générer la lettre (PDF)
                </button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
