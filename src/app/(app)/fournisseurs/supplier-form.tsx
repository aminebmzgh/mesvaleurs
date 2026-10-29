"use client";

import { useActionState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type FormState, initialFormState } from "@/lib/forms";
import { formatRib } from "@/lib/rib";

export type SupplierValues = {
  name: string;
  payee_name: string | null;
  ice: string | null;
  tax_id: string | null;
  trade_register: string | null;
  rib: string | null;
  address: string | null;
  city: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  payment_terms_days: number | null;
  print_cover_letter: boolean;
  notes: string | null;
  accounting_code?: string | null;
};

type TextField = {
  name: keyof SupplierValues;
  label: string;
  description?: string;
  wide?: boolean;
  type?: string;
  inputMode?: "numeric" | "email" | "tel";
  mono?: boolean;
};

const IDENTITY_FIELDS: TextField[] = [
  { name: "name", label: "Raison sociale", wide: true },
  {
    name: "payee_name",
    label: "Nom imprimé sur les chèques",
    description: "Bénéficiaire exact attendu par le fournisseur. À défaut : la raison sociale.",
    wide: true,
  },
  { name: "ice", label: "ICE", description: "15 chiffres", inputMode: "numeric" },
  { name: "tax_id", label: "Identifiant fiscal (IF)" },
  { name: "trade_register", label: "Registre de commerce (RC)" },
  { name: "rib", label: "RIB", description: "Clé vérifiée automatiquement", inputMode: "numeric", mono: true },
];

const CONTACT_FIELDS: TextField[] = [
  { name: "address", label: "Adresse", wide: true },
  { name: "city", label: "Ville" },
  { name: "contact_name", label: "Contact" },
  { name: "email", label: "E-mail", type: "email", inputMode: "email" },
  { name: "phone", label: "Téléphone", type: "tel", inputMode: "tel" },
];

export function SupplierForm({
  action,
  supplier,
  submitLabel,
  readOnly = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  supplier?: SupplierValues;
  submitLabel: string;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

  const renderField = (field: TextField) => {
    const raw = supplier?.[field.name];
    const value = field.name === "rib" && typeof raw === "string" ? formatRib(raw) : ((raw as string | null) ?? "");
    return (
      <Field key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
        <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
        <Input
          id={field.name}
          name={field.name}
          type={field.type}
          inputMode={field.inputMode}
          defaultValue={value}
          className={field.mono ? "font-mono" : undefined}
          {...invalidProps(state, field.name)}
        />
        {field.description && <FieldDescription>{field.description}</FieldDescription>}
        <FieldErrors state={state} name={field.name} />
      </Field>
    );
  };

  return (
    <ActionForm action={formAction} pending={pending} noValidate>
      <fieldset disabled={readOnly}>
        <FieldGroup>
          <FormMessage state={state} />
          <div className="grid gap-4 sm:grid-cols-2">{IDENTITY_FIELDS.map(renderField)}</div>
          <div className="grid gap-4 sm:grid-cols-2">{CONTACT_FIELDS.map(renderField)}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="payment_terms_days">Délai de paiement convenu (jours)</FieldLabel>
              <Input
                id="payment_terms_days"
                name="payment_terms_days"
                inputMode="numeric"
                placeholder="60"
                defaultValue={supplier?.payment_terms_days ?? ""}
                {...invalidProps(state, "payment_terms_days")}
              />
              <FieldDescription>Sert au calcul de la date limite de paiement (loi 69-21).</FieldDescription>
              <FieldErrors state={state} name="payment_terms_days" />
            </Field>
            <Field>
              <FieldLabel htmlFor="accounting_code">Code comptable (compte auxiliaire)</FieldLabel>
              <Input
                id="accounting_code"
                name="accounting_code"
                placeholder="Ex. FSOTRAMA"
                defaultValue={supplier?.accounting_code ?? ""}
                className="font-mono"
                {...invalidProps(state, "accounting_code")}
              />
              <FieldDescription>Repris dans l&apos;export comptable mensuel.</FieldDescription>
              <FieldErrors state={state} name="accounting_code" />
            </Field>
            <Field orientation="horizontal" className="sm:mt-6">
              <input
                id="print_cover_letter"
                name="print_cover_letter"
                type="checkbox"
                defaultChecked={supplier?.print_cover_letter ?? true}
                className="mt-0.5 size-4 accent-primary"
              />
              <FieldContent>
                <FieldLabel htmlFor="print_cover_letter">Joindre une lettre d&apos;accompagnement</FieldLabel>
                <FieldDescription>Cochée par défaut dans l&apos;assistant de paiement.</FieldDescription>
              </FieldContent>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Textarea id="notes" name="notes" rows={3} defaultValue={supplier?.notes ?? ""} {...invalidProps(state, "notes")} />
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
