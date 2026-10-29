"use client";

import { useActionState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { initialFormState } from "@/lib/forms";
import type { AccountingExportSettings } from "@/lib/organizations/settings";
import { updateAccountingExport } from "./actions";

const SELECT_CLASS = "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30";

const ACCOUNTS: { name: "journal" | "supplierAccount" | "bankAccount" | "billsAccount"; label: string; description: string }[] = [
  { name: "journal", label: "Code journal", description: "Journal de banque (ex. BQ)." },
  { name: "supplierAccount", label: "Compte fournisseurs", description: "Le code comptable du fournisseur, s'il est renseigné, va en compte auxiliaire." },
  { name: "bankAccount", label: "Compte de banque par défaut", description: "Remplacé par le code comptable du compte bancaire, s'il est renseigné." },
  { name: "billsAccount", label: "Compte d'effets à payer", description: "LCN enregistrées à l'émission (base « émission »)." },
];

export function AccountingExportForm({ settings, readOnly }: { settings: AccountingExportSettings; readOnly: boolean }) {
  const [state, action, pending] = useActionState(updateAccountingExport, initialFormState);
  return (
    <ActionForm action={action} pending={pending} noValidate className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Export comptable mensuel</CardTitle>
          <CardDescription>
            Journal des règlements fournisseurs, depuis Rapports : deux lignes par règlement (débit et crédit).
            {readOnly && " Seul un administrateur peut modifier ces paramètres."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset disabled={readOnly}>
            <FieldGroup>
              <FormMessage state={state} />
              <div className="grid gap-4 sm:grid-cols-2">
                {ACCOUNTS.map((field) => (
                  <Field key={field.name}>
                    <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
                    <Input id={field.name} name={field.name} defaultValue={settings[field.name]} className="font-mono" {...invalidProps(state, field.name)} />
                    <FieldDescription>{field.description}</FieldDescription>
                    <FieldErrors state={state} name={field.name} />
                  </Field>
                ))}
              </div>
              <Field>
                <FieldLabel htmlFor="basis">Base d&apos;enregistrement</FieldLabel>
                <select id="basis" name="basis" defaultValue={settings.basis} className={SELECT_CLASS}>
                  <option value="debit">Date de débit en banque (fournisseurs / banque)</option>
                  <option value="issue">Date d&apos;émission (chèques et virements : fournisseurs / banque ; LCN : fournisseurs / effets à payer, puis effets / banque au débit)</option>
                </select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="separator">Séparateur</FieldLabel>
                  <select id="separator" name="separator" defaultValue={settings.separator} className={SELECT_CLASS}>
                    <option value=";">Point-virgule (;)</option>
                    <option value=",">Virgule (,)</option>
                    <option value="tab">Tabulation</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="dateFormat">Format de date</FieldLabel>
                  <select id="dateFormat" name="dateFormat" defaultValue={settings.dateFormat} className={SELECT_CLASS}>
                    <option value="dd/mm/yyyy">31/10/2026</option>
                    <option value="yyyy-mm-dd">2026-10-31</option>
                    <option value="ddmmyy">311026</option>
                  </select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="decimal">Séparateur décimal</FieldLabel>
                  <select id="decimal" name="decimal" defaultValue={settings.decimal} className={SELECT_CLASS}>
                    <option value=",">Virgule (1234,56)</option>
                    <option value=".">Point (1234.56)</option>
                  </select>
                </Field>
              </div>
              <Field orientation="horizontal">
                <input id="header" name="header" type="checkbox" defaultChecked={settings.header} className="mt-0.5 size-4 accent-primary" />
                <FieldContent>
                  <FieldLabel htmlFor="header">Ligne d&apos;en-tête</FieldLabel>
                  <FieldDescription>Date ; Journal ; Compte ; Compte auxiliaire ; Pièce ; Libellé ; Débit ; Crédit.</FieldDescription>
                </FieldContent>
              </Field>
              {!readOnly && (
                <div className="flex justify-end">
                  <SubmitButton>Enregistrer</SubmitButton>
                </div>
              )}
            </FieldGroup>
          </fieldset>
        </CardContent>
      </Card>
    </ActionForm>
  );
}
