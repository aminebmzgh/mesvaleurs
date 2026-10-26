"use client";

import { useActionState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { amountInWords } from "@/lib/amount-in-words";
import { formatAmount } from "@/lib/format";
import { initialFormState } from "@/lib/forms";
import { updateOrganization } from "./actions";

type OrganizationValues = {
  name: string;
  ice: string | null;
  tax_id: string | null;
  trade_register: string | null;
  patente: string | null;
  cnss: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  annual_revenue: number | null;
  require_mfa: boolean;
  amount_words_rectified: boolean;
};

const TEXT_FIELDS: { name: keyof OrganizationValues; label: string; description?: string; wide?: boolean }[] = [
  { name: "name", label: "Raison sociale", wide: true },
  { name: "ice", label: "ICE", description: "15 chiffres" },
  { name: "tax_id", label: "Identifiant fiscal (IF)" },
  { name: "trade_register", label: "Registre de commerce (RC)" },
  { name: "patente", label: "Patente" },
  { name: "cnss", label: "CNSS" },
  { name: "address", label: "Adresse", wide: true },
  { name: "city", label: "Ville", description: "Lieu d'émission par défaut des chèques et LCN" },
  { name: "phone", label: "Téléphone" },
  { name: "email", label: "E-mail" },
];

export function OrganizationForm({
  organization,
  readOnly,
}: {
  organization: OrganizationValues;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(updateOrganization, initialFormState);

  return (
    <ActionForm action={action} pending={pending} noValidate className="max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>Identité de l&apos;entreprise</CardTitle>
          {readOnly && (
            <CardDescription>Seul un administrateur peut modifier ces informations.</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <fieldset disabled={readOnly}>
            <FieldGroup>
              <FormMessage state={state} />
              <div className="grid gap-4 sm:grid-cols-2">
                {TEXT_FIELDS.map((field) => (
                  <Field key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
                    <FieldLabel htmlFor={field.name}>{field.label}</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      defaultValue={(organization[field.name] as string | null) ?? ""}
                      {...invalidProps(state, field.name)}
                    />
                    {field.description && <FieldDescription>{field.description}</FieldDescription>}
                    <FieldErrors state={state} name={field.name} />
                  </Field>
                ))}
                <Field>
                  <FieldLabel htmlFor="annual_revenue">Chiffre d&apos;affaires annuel (DH)</FieldLabel>
                  <Input
                    id="annual_revenue"
                    name="annual_revenue"
                    inputMode="decimal"
                    defaultValue={organization.annual_revenue != null ? formatAmount(organization.annual_revenue) : ""}
                    {...invalidProps(state, "annual_revenue")}
                  />
                  <FieldDescription>Détermine le régime applicable au titre de la loi 69-21.</FieldDescription>
                  <FieldErrors state={state} name="annual_revenue" />
                </Field>
              </div>
              <Field orientation="horizontal">
                <input
                  id="require_mfa"
                  name="require_mfa"
                  type="checkbox"
                  defaultChecked={organization.require_mfa}
                  className="mt-0.5 size-4 accent-primary"
                />
                <FieldContent>
                  <FieldLabel htmlFor="require_mfa">
                    Double authentification obligatoire pour les administrateurs et gestionnaires
                  </FieldLabel>
                  <FieldDescription>
                    Les personnes concernées devront l&apos;activer avant d&apos;accéder aux données.
                  </FieldDescription>
                </FieldContent>
              </Field>
              <Field orientation="horizontal">
                <input
                  id="amount_words_rectified"
                  name="amount_words_rectified"
                  type="checkbox"
                  defaultChecked={organization.amount_words_rectified}
                  className="mt-0.5 size-4 accent-primary"
                />
                <FieldContent>
                  <FieldLabel htmlFor="amount_words_rectified">
                    Montant en lettres selon l&apos;orthographe rectifiée de 1990
                  </FieldLabel>
                  <FieldDescription>
                    Traditionnelle : « {amountInWords(1221.21)} ». Rectifiée : «{" "}
                    {amountInWords(1221.21, { rectified: true })} ».
                  </FieldDescription>
                </FieldContent>
              </Field>
            </FieldGroup>
          </fieldset>
        </CardContent>
        {!readOnly && (
          <CardFooter className="justify-end border-t pt-4">
            <SubmitButton>Enregistrer</SubmitButton>
          </CardFooter>
        )}
      </Card>
    </ActionForm>
  );
}
