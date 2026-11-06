"use client";

import { CircleAlertIcon, CircleCheckIcon, Loader2Icon, SparklesIcon, TriangleAlertIcon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { SelectOption } from "@/components/form-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_FILE_TYPES, AiFileError, prepareInvoiceForAi } from "@/lib/invoices/ai-file";
import { ATTACHMENT_MAX_BYTES, attachmentPath } from "@/lib/invoices/schemas";
import { createClient } from "@/lib/supabase/client";
import type { createInvoice } from "../actions";
import { InvoiceForm, type InvoiceValues } from "../invoice-form";
import { type AiReadingResult, createSupplierFromReading, readInvoiceWithAi } from "./actions";

export type AiAvailability = { included: boolean; enabled: boolean; quota: number; used: number } | null;

type Reading = AiReadingResult & {
  /** Pièce déposée dans le stockage, rattachée à la facture à l'enregistrement. */
  attachment: { invoiceId: string; path: string } | null;
  fileName: string;
};

/**
 * Nouvelle facture, avec lecture facultative de la pièce par l'IA : le résultat
 * pré-remplit le formulaire, que l'utilisateur vérifie avant d'enregistrer.
 */
export function AiInvoiceEntry({
  action,
  suppliers: initialSuppliers,
  prefill,
  defaultSupplierId,
  organizationId,
  ai,
  isAdmin,
}: {
  action: typeof createInvoice;
  suppliers: SelectOption[];
  prefill?: Partial<InvoiceValues>;
  defaultSupplierId?: string;
  organizationId: string;
  ai: AiAvailability;
  isAdmin: boolean;
}) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState(ai?.used ?? 0);
  const [formKey, setFormKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [creating, startCreating] = useTransition();

  const read = (file: File) => {
    setError(null);
    if (!AI_FILE_TYPES.includes(file.type)) {
      setError("Format non accepté : PDF, JPEG ou PNG uniquement.");
      return;
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
      setError("Fichier trop volumineux : 20 Mo maximum.");
      return;
    }
    startTransition(async () => {
      let document;
      try {
        document = await prepareInvoiceForAi(file);
      } catch (cause) {
        setError(cause instanceof AiFileError ? cause.message : "Document illisible.");
        return;
      }
      // La pièce part vers le stockage pendant la lecture ; sans elle, la facture reste saisissable
      const invoiceId = crypto.randomUUID();
      const path = attachmentPath(organizationId, invoiceId, file.name, crypto.randomUUID());
      const [result, upload] = await Promise.all([
        readInvoiceWithAi(document),
        createClient().storage.from("factures").upload(path, file, { contentType: file.type, upsert: false }),
      ]);
      if ("error" in result) {
        setError(result.error);
        if (!upload.error) {
          await createClient().storage.from("factures").remove([path]);
        }
        return;
      }
      // Pièce d'une lecture précédente, abandonnée
      if (reading?.attachment) {
        await createClient().storage.from("factures").remove([reading.attachment.path]);
      }
      setUsed(result.usage.used);
      setReading({ ...result, attachment: upload.error ? null : { invoiceId, path }, fileName: file.name });
      setFormKey((key) => key + 1);
    });
  };

  const createSupplier = () =>
    startCreating(async () => {
      if (!reading) {
        return;
      }
      const party = reading.invoice.supplier;
      const response = await createSupplierFromReading({
        name: party.name ?? "",
        ice: party.ice ?? "",
        tax_id: party.taxId ?? "",
        trade_register: party.tradeRegister ?? "",
        city: party.city ?? "",
      });
      if (response.error || !response.supplier) {
        setError(response.error ?? "Impossible de créer le fournisseur.");
        return;
      }
      const supplier = response.supplier;
      setSuppliers((current) => [...current, { value: supplier.id, label: supplier.name }].sort((a, b) => a.label.localeCompare(b.label, "fr")));
      setReading({ ...reading, supplier });
      setFormKey((key) => key + 1);
    });

  const values: Partial<InvoiceValues> | undefined = reading
    ? {
        supplier_id: reading.supplier?.id ?? "",
        number: reading.invoice.number ?? "",
        issue_date: reading.invoice.issueDate ?? "",
        delivery_date: reading.invoice.deliveryDate,
        amount_excl_tax: reading.invoice.amountExclTax,
        vat_amount: reading.invoice.vatAmount,
        amount_incl_tax: reading.invoice.amountInclTax ?? undefined,
        payment_terms_days: reading.paymentTermsDays,
      }
    : prefill;
  const remaining = ai ? Math.max(0, ai.quota - used) : 0;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {ai && !ai.included && (
        <p className="text-sm text-muted-foreground">
          <SparklesIcon className="me-1 inline size-4" aria-hidden />
          Lecture des factures par IA : offre Pro et supérieures.{" "}
          <Link href="/parametres/abonnement" className="underline">
            Voir les offres
          </Link>
        </p>
      )}

      {ai?.included && !ai.enabled && (
        <p className="text-sm text-muted-foreground">
          <SparklesIcon className="me-1 inline size-4" aria-hidden />
          Lecture des factures par IA désactivée pour votre entreprise.{" "}
          {isAdmin ? (
            <Link href="/parametres/organisation#ia" className="underline">
              L&apos;activer dans les paramètres
            </Link>
          ) : (
            "Un administrateur peut l'activer dans les paramètres."
          )}
        </p>
      )}

      {ai?.enabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4" aria-hidden />
              Lire la facture avec l&apos;IA
            </CardTitle>
            <CardDescription>
              PDF, scan ou photo : fournisseur, numéro, dates et montants pré-remplis, à vérifier avant d&apos;enregistrer. Le
              document est envoyé à un service d&apos;IA hors du Maroc, qui ne le conserve pas ; dans un PDF texte, e-mails,
              téléphones et RIB sont masqués. Lectures restantes ce mois : {remaining} sur {ai.quota}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="ai-invoice-file">Facture</label>
              <input
                id="ai-invoice-file"
                type="file"
                accept={AI_FILE_TYPES.join(",")}
                className="text-sm file:me-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1"
                disabled={pending || remaining === 0}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    read(file);
                  }
                  event.target.value = "";
                }}
              />
              {pending && (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" aria-hidden />
                  Lecture en cours…
                </span>
              )}
            </div>
            {error && (
              <Alert variant="destructive">
                <CircleAlertIcon aria-hidden />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {reading && (
              <div className="flex flex-col gap-2" role="status" aria-label="Résultat de la lecture">
                <p className="flex items-start gap-2">
                  <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  {reading.fileName} lu : vérifiez chaque champ du formulaire ci-dessous.
                  {reading.attachment ? " Le document sera joint à la facture et archivé." : " Le document n'a pas pu être joint : ajoutez-le après l'enregistrement."}
                </p>
                {reading.supplier ? (
                  <p className="flex items-start gap-2">
                    <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                    Fournisseur reconnu : {reading.supplier.name}
                  </p>
                ) : reading.invoice.supplier.name ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                      Fournisseur inconnu : « {reading.invoice.supplier.name} »
                      {reading.invoice.supplier.ice && ` (ICE ${reading.invoice.supplier.ice})`}
                    </span>
                    <Button type="button" variant="outline" size="sm" disabled={creating} onClick={createSupplier}>
                      {creating ? <Loader2Icon className="animate-spin" aria-hidden /> : <UserPlusIcon aria-hidden />}
                      Créer ce fournisseur
                    </Button>
                  </div>
                ) : null}
                {reading.anomalies.map((anomaly) => (
                  <p
                    key={anomaly.message}
                    className={`flex items-start gap-2 ${anomaly.level === "error" ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}
                  >
                    {anomaly.level === "error" ? (
                      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    ) : (
                      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                    )}
                    {anomaly.message}
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <InvoiceForm
            key={formKey}
            action={action}
            suppliers={suppliers}
            invoice={values}
            defaultSupplierId={reading ? undefined : defaultSupplierId}
            submitLabel="Enregistrer la facture"
            hiddenFields={
              reading?.attachment ? { attachment_invoice_id: reading.attachment.invoiceId, attachment_path: reading.attachment.path } : undefined
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
