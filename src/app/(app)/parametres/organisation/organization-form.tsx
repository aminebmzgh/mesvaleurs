"use client";

import { useActionState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { FormSelect } from "@/components/form-select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { amountInWords } from "@/lib/amount-in-words";
import { formatAmount } from "@/lib/format";
import { initialFormState } from "@/lib/forms";
import { DECLARATION_REMINDER_CHOICES, DUE_ALERT_CHOICES, LOW_STOCK_CHOICES, UNCASHED_ALERT_CHOICES } from "@/lib/organizations/settings";
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
  uncashed_alert_days: number;
  low_stock_threshold: number;
  lcn_alert_days: number;
  invoice_alert_days: number;
  late_payment_basis: "remittance" | "debit";
  declaration_reminder_days: number;
  approval_threshold: number | null;
  daily_ceiling: number | null;
  payment_reserve: number;
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
  approvalsIncluded = true,
}: {
  organization: OrganizationValues;
  readOnly: boolean;
  /** Double signature et plafonds compris dans l'offre (Business et Cabinet). */
  approvalsIncluded?: boolean;
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
              <Field className="max-w-sm">
                <FieldLabel htmlFor="uncashed_alert_days">Signaler un chèque non encaissé après</FieldLabel>
                <FormSelect
                  id="uncashed_alert_days"
                  name="uncashed_alert_days"
                  options={UNCASHED_ALERT_CHOICES.map((days) => ({ value: String(days), label: `${days} jours` }))}
                  defaultValue={String(organization.uncashed_alert_days)}
                />
                <FieldDescription>Délai depuis l&apos;émission, pour la liste des chèques non encaissés et le tableau de bord.</FieldDescription>
              </Field>
              <Field className="max-w-sm">
                <FieldLabel htmlFor="low_stock_threshold">Signaler un carnet presque épuisé à partir de</FieldLabel>
                <FormSelect
                  id="low_stock_threshold"
                  name="low_stock_threshold"
                  options={LOW_STOCK_CHOICES.map((count) => ({ value: String(count), label: `${count} formules restantes` }))}
                  defaultValue={String(organization.low_stock_threshold)}
                />
                <FieldDescription>Pour commander un nouveau chéquier ou carnet de LCN à temps.</FieldDescription>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="lcn_alert_days">Signaler une LCN à échoir</FieldLabel>
                  <FormSelect
                    id="lcn_alert_days"
                    name="lcn_alert_days"
                    options={DUE_ALERT_CHOICES.map((days) => ({ value: String(days), label: `${days} jours avant` }))}
                    defaultValue={String(organization.lcn_alert_days)}
                  />
                  <FieldDescription>Pour provisionner le compte avant l&apos;échéance.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="invoice_alert_days">Signaler une facture à payer</FieldLabel>
                  <FormSelect
                    id="invoice_alert_days"
                    name="invoice_alert_days"
                    options={DUE_ALERT_CHOICES.map((days) => ({ value: String(days), label: `${days} jours avant` }))}
                    defaultValue={String(organization.invoice_alert_days)}
                  />
                  <FieldDescription>Avant la date limite légale (loi 69-21). Alertes : page Alertes et e-mail du matin.</FieldDescription>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="late_payment_basis">Date de paiement retenue (loi 69-21)</FieldLabel>
                  <FormSelect
                    id="late_payment_basis"
                    name="late_payment_basis"
                    options={[
                      { value: "remittance", label: "Remise du chèque, échéance de la LCN" },
                      { value: "debit", label: "Date de débit en banque" },
                    ]}
                    defaultValue={organization.late_payment_basis}
                  />
                  <FieldDescription>Pour mesurer le retard de paiement d&apos;une facture et calculer l&apos;amende indicative.</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="declaration_reminder_days">Rappeler la déclaration trimestrielle</FieldLabel>
                  <FormSelect
                    id="declaration_reminder_days"
                    name="declaration_reminder_days"
                    options={DECLARATION_REMINDER_CHOICES.map((days) => ({ value: String(days), label: `${days} jours avant` }))}
                    defaultValue={String(organization.declaration_reminder_days)}
                  />
                  <FieldDescription>Déclaration des délais de paiement : avant sa date limite, jusqu&apos;à ce qu&apos;elle soit marquée « déclarée ».</FieldDescription>
                </Field>
              </div>
              {!approvalsIncluded && (
                <p className="text-sm text-muted-foreground">
                  Double signature et plafonds : offre Business. Les montants saisis sont conservés, mais sans effet avec votre offre actuelle.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="approval_threshold">Double signature au-delà de (DH)</FieldLabel>
                  <Input
                    id="approval_threshold"
                    name="approval_threshold"
                    inputMode="decimal"
                    placeholder="Désactivée"
                    defaultValue={organization.approval_threshold != null ? formatAmount(organization.approval_threshold) : ""}
                    {...invalidProps(state, "approval_threshold")}
                  />
                  <FieldDescription>
                    Une formule plus élevée est validée par un gestionnaire ou un administrateur, autre que le préparateur, avant
                    impression.
                  </FieldDescription>
                  <FieldErrors state={state} name="approval_threshold" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="daily_ceiling">Plafond journalier de l&apos;entreprise (DH)</FieldLabel>
                  <Input
                    id="daily_ceiling"
                    name="daily_ceiling"
                    inputMode="decimal"
                    placeholder="Aucun"
                    defaultValue={organization.daily_ceiling != null ? formatAmount(organization.daily_ceiling) : ""}
                    {...invalidProps(state, "daily_ceiling")}
                  />
                  <FieldDescription>
                    Au-delà, pour le total des paiements datés du jour, le lot passe en validation. Plafonds par membre et par
                    fournisseur : pages Membres et fiche fournisseur.
                  </FieldDescription>
                  <FieldErrors state={state} name="daily_ceiling" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="payment_reserve">Réserve de trésorerie (DH)</FieldLabel>
                  <Input
                    id="payment_reserve"
                    name="payment_reserve"
                    inputMode="decimal"
                    placeholder="0,00"
                    defaultValue={organization.payment_reserve ? formatAmount(organization.payment_reserve) : ""}
                    {...invalidProps(state, "payment_reserve")}
                  />
                  <FieldDescription>
                    Solde prévisionnel que l&apos;optimiseur de paiements ne doit jamais entamer (modifiable à chaque calcul).
                  </FieldDescription>
                  <FieldErrors state={state} name="payment_reserve" />
                </Field>
              </div>
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
