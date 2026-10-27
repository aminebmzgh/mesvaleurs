"use client";

import { useActionState, useState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { FormSelect, type SelectOption } from "@/components/form-select";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fromCents, parseAmount, toCents } from "@/lib/amount";
import { formatAmount } from "@/lib/format";
import { type FormState, initialFormState } from "@/lib/forms";
import { DEFAULT_VAT_RATE, fromExclTax, fromInclTax } from "@/lib/invoices/vat";

export type InvoiceValues = {
  supplier_id: string;
  number: string;
  issue_date: string;
  delivery_date: string | null;
  amount_excl_tax: number | null;
  vat_amount: number | null;
  amount_incl_tax: number;
  payment_terms_days: number | null;
  notes: string | null;
};

const amount = (value: number | null | undefined) => (value != null ? formatAmount(value) : "");
const fromCentsText = (cents: number) => formatAmount(fromCents(cents));

type AmountKey = "excl" | "vat" | "incl";

/**
 * HT, TVA et TTC : le premier montant saisi (HT ou TTC) calcule les deux autres à
 * 20 %. Les montants calculés restent modifiables (autre taux, arrondi du fournisseur) ;
 * modifier la TVA recalcule le montant non saisi.
 */
function AmountFields({ state, invoice }: { state: FormState; invoice?: InvoiceValues }) {
  const [values, setValues] = useState<Record<AmountKey, string>>({
    excl: amount(invoice?.amount_excl_tax),
    vat: amount(invoice?.vat_amount),
    incl: amount(invoice?.amount_incl_tax),
  });
  // Montant de départ : celui que l'utilisateur a saisi en premier
  const [source, setSource] = useState<"excl" | "incl" | null>(null);

  const change = (key: AmountKey, text: string) => {
    const next = { ...values, [key]: text };
    const parsed = parseAmount(text);
    let from = source;
    if ((key === "excl" || key === "incl") && (from === null || from === key)) {
      from = text.trim() === "" ? null : key;
      setSource(from);
    }

    if (key === from && parsed !== null) {
      if (key === "excl") {
        const { vatCents, inclCents } = fromExclTax(toCents(parsed));
        next.vat = fromCentsText(vatCents);
        next.incl = fromCentsText(inclCents);
      } else {
        const { exclCents, vatCents } = fromInclTax(toCents(parsed));
        next.excl = fromCentsText(exclCents);
        next.vat = fromCentsText(vatCents);
      }
    } else if (key === source && from === null) {
      // Montant de départ effacé : les montants calculés aussi
      next.vat = "";
      next[key === "excl" ? "incl" : "excl"] = "";
    } else if (key === "vat" && parsed !== null && source !== null) {
      // TVA corrigée : le montant calculé suit
      const base = parseAmount(values[source]);
      if (base !== null) {
        const sign = source === "excl" ? 1 : -1;
        const cents = toCents(base) + sign * toCents(parsed);
        if (cents >= 0) {
          next[source === "excl" ? "incl" : "excl"] = fromCentsText(cents);
        }
      }
    }
    setValues(next);
  };

  const fields: { key: AmountKey; name: keyof InvoiceValues; label: string }[] = [
    { key: "excl", name: "amount_excl_tax", label: "Montant HT (DH)" },
    { key: "vat", name: "vat_amount", label: "TVA (DH)" },
    { key: "incl", name: "amount_incl_tax", label: "Montant TTC (DH)" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {fields.map(({ key, name, label }) => (
        <Field key={key}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            id={name}
            name={name}
            inputMode="decimal"
            value={values[key]}
            onChange={(event) => change(key, event.target.value)}
            className="tabular-nums"
            {...invalidProps(state, name)}
          />
          {key === "vat" && <FieldDescription>Calculée à {DEFAULT_VAT_RATE} %, modifiable.</FieldDescription>}
          <FieldErrors state={state} name={name} />
        </Field>
      ))}
    </div>
  );
}

export function InvoiceForm({
  action,
  suppliers,
  invoice,
  defaultSupplierId,
  submitLabel,
  readOnly = false,
  supplierLocked = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  suppliers: SelectOption[];
  invoice?: InvoiceValues;
  defaultSupplierId?: string;
  submitLabel: string;
  readOnly?: boolean;
  /** Fournisseur figé : facture déjà rattachée à des paiements. */
  supplierLocked?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <ActionForm action={formAction} pending={pending} noValidate>
      <fieldset disabled={readOnly}>
        <FieldGroup>
          <FormMessage state={state} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="supplier_id">Fournisseur</FieldLabel>
              <FormSelect
                id="supplier_id"
                name="supplier_id"
                options={suppliers}
                defaultValue={invoice?.supplier_id ?? defaultSupplierId}
                placeholder="Choisir un fournisseur"
                disabled={readOnly || supplierLocked}
                invalid={Boolean(state.fieldErrors?.supplier_id)}
              />
              {/* Un champ désactivé n'est pas soumis : la valeur figée est transmise à part */}
              {supplierLocked && invoice && <input type="hidden" name="supplier_id" value={invoice.supplier_id} />}
              {supplierLocked && (
                <FieldDescription>Facture rattachée à des paiements : le fournisseur ne peut plus changer.</FieldDescription>
              )}
              <FieldErrors state={state} name="supplier_id" />
            </Field>
            <Field>
              <FieldLabel htmlFor="number">Numéro de facture</FieldLabel>
              <Input id="number" name="number" defaultValue={invoice?.number} {...invalidProps(state, "number")} />
              <FieldErrors state={state} name="number" />
            </Field>
            <Field>
              <FieldLabel htmlFor="issue_date">Date de facture</FieldLabel>
              <Input id="issue_date" name="issue_date" type="date" defaultValue={invoice?.issue_date} {...invalidProps(state, "issue_date")} />
              <FieldErrors state={state} name="issue_date" />
            </Field>
            <Field>
              <FieldLabel htmlFor="delivery_date">Date de livraison</FieldLabel>
              <Input
                id="delivery_date"
                name="delivery_date"
                type="date"
                defaultValue={invoice?.delivery_date ?? ""}
                {...invalidProps(state, "delivery_date")}
              />
              <FieldErrors state={state} name="delivery_date" />
            </Field>
            <Field>
              <FieldLabel htmlFor="payment_terms_days">Délai convenu (jours)</FieldLabel>
              <Input
                id="payment_terms_days"
                name="payment_terms_days"
                inputMode="numeric"
                placeholder="Délai du fournisseur"
                defaultValue={invoice?.payment_terms_days ?? ""}
                {...invalidProps(state, "payment_terms_days")}
              />
              <FieldDescription>Vide : délai du fournisseur, sinon délai légal par défaut.</FieldDescription>
              <FieldErrors state={state} name="payment_terms_days" />
            </Field>
          </div>
          <AmountFields state={state} invoice={invoice} />
          <Field>
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Textarea id="notes" name="notes" rows={2} defaultValue={invoice?.notes ?? ""} {...invalidProps(state, "notes")} />
            <FieldErrors state={state} name="notes" />
          </Field>
          {!readOnly && (
            <div className="flex justify-end">
              <SubmitButton>{submitLabel}</SubmitButton>
            </div>
          )}
        </FieldGroup>
      </fieldset>
    </ActionForm>
  );
}
