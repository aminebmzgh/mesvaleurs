"use client";

import { useActionState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { FormSelect, type SelectOption } from "@/components/form-select";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatAmount } from "@/lib/format";
import { type FormState, initialFormState } from "@/lib/forms";

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
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="amount_excl_tax">Montant HT (DH)</FieldLabel>
              <Input
                id="amount_excl_tax"
                name="amount_excl_tax"
                inputMode="decimal"
                defaultValue={amount(invoice?.amount_excl_tax)}
                className="tabular-nums"
                {...invalidProps(state, "amount_excl_tax")}
              />
              <FieldErrors state={state} name="amount_excl_tax" />
            </Field>
            <Field>
              <FieldLabel htmlFor="vat_amount">TVA (DH)</FieldLabel>
              <Input
                id="vat_amount"
                name="vat_amount"
                inputMode="decimal"
                defaultValue={amount(invoice?.vat_amount)}
                className="tabular-nums"
                {...invalidProps(state, "vat_amount")}
              />
              <FieldErrors state={state} name="vat_amount" />
            </Field>
            <Field>
              <FieldLabel htmlFor="amount_incl_tax">Montant TTC (DH)</FieldLabel>
              <Input
                id="amount_incl_tax"
                name="amount_incl_tax"
                inputMode="decimal"
                defaultValue={amount(invoice?.amount_incl_tax)}
                className="tabular-nums"
                {...invalidProps(state, "amount_incl_tax")}
              />
              <FieldErrors state={state} name="amount_incl_tax" />
            </Field>
          </div>
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
