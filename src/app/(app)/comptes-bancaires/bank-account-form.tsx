"use client";

import { useActionState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { FormSelect, type SelectOption } from "@/components/form-select";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/lib/format";
import { type FormState, initialFormState } from "@/lib/forms";
import { formatRib } from "@/lib/rib";

export type BankAccountValues = {
  bank_id: string;
  label: string;
  branch: string | null;
  rib: string | null;
  opening_balance: number;
  opening_balance_date: string;
};

export function BankAccountForm({
  action,
  banks,
  account,
  submitLabel,
  readOnly = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  banks: SelectOption[];
  account?: BankAccountValues;
  submitLabel: string;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  return (
    <ActionForm action={formAction} pending={pending} noValidate>
      <fieldset disabled={readOnly}>
        <FieldGroup>
          <FormMessage state={state} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="bank_id">Banque</FieldLabel>
              <FormSelect
                id="bank_id"
                name="bank_id"
                options={banks}
                defaultValue={account?.bank_id}
                placeholder="Choisir une banque"
                disabled={readOnly}
                invalid={Boolean(state.fieldErrors?.bank_id)}
              />
              <FieldErrors state={state} name="bank_id" />
            </Field>
            <Field>
              <FieldLabel htmlFor="label">Libellé</FieldLabel>
              <Input
                id="label"
                name="label"
                placeholder="Ex. Compte principal"
                defaultValue={account?.label}
                required
                {...invalidProps(state, "label")}
              />
              <FieldErrors state={state} name="label" />
            </Field>
            <Field>
              <FieldLabel htmlFor="branch">Agence</FieldLabel>
              <Input id="branch" name="branch" defaultValue={account?.branch ?? ""} {...invalidProps(state, "branch")} />
              <FieldErrors state={state} name="branch" />
            </Field>
            <Field>
              <FieldLabel htmlFor="rib">RIB</FieldLabel>
              <Input
                id="rib"
                name="rib"
                inputMode="numeric"
                autoComplete="off"
                placeholder="24 chiffres"
                defaultValue={account?.rib ? formatRib(account.rib) : ""}
                className="font-mono"
                {...invalidProps(state, "rib")}
              />
              <FieldDescription>La clé (2 derniers chiffres) est vérifiée automatiquement.</FieldDescription>
              <FieldErrors state={state} name="rib" />
            </Field>
            <Field>
              <FieldLabel htmlFor="opening_balance">Solde d&apos;ouverture (DH)</FieldLabel>
              <Input
                id="opening_balance"
                name="opening_balance"
                inputMode="decimal"
                defaultValue={account ? formatAmount(account.opening_balance) : "0,00"}
                className="tabular-nums"
                {...invalidProps(state, "opening_balance")}
              />
              <FieldErrors state={state} name="opening_balance" />
            </Field>
            <Field>
              <FieldLabel htmlFor="opening_balance_date">Date du solde d&apos;ouverture</FieldLabel>
              <Input
                id="opening_balance_date"
                name="opening_balance_date"
                type="date"
                defaultValue={account?.opening_balance_date ?? ""}
                {...invalidProps(state, "opening_balance_date")}
              />
              <FieldDescription>Point de départ du solde et des rapprochements.</FieldDescription>
              <FieldErrors state={state} name="opening_balance_date" />
            </Field>
          </div>
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
