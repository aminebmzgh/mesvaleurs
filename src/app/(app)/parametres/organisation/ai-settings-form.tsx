"use client";

import { useActionState, useState } from "react";
import { ActionForm, FieldErrors, FormMessage, SubmitButton } from "@/components/forms";
import { FormSelect } from "@/components/form-select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { formatDateTime } from "@/lib/format";
import { initialFormState } from "@/lib/forms";
import { AI_QUOTA_CHOICES } from "@/lib/organizations/settings";
import { updateAiSettings } from "./actions";

export function AiSettingsForm({
  enabled,
  consent,
  quota,
  used,
  readOnly,
}: {
  enabled: boolean;
  consent: { at: string; email: string | null } | null;
  quota: number;
  used: number;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(updateAiSettings, initialFormState);
  const [checked, setChecked] = useState(enabled);
  const quotaChoices: readonly number[] = AI_QUOTA_CHOICES.includes(quota as (typeof AI_QUOTA_CHOICES)[number])
    ? AI_QUOTA_CHOICES
    : [...AI_QUOTA_CHOICES, quota].sort((a, b) => a - b);

  return (
    <ActionForm action={action} pending={pending} noValidate className="max-w-3xl" id="ia">
      <Card>
        <CardHeader>
          <CardTitle>Intelligence artificielle</CardTitle>
          <CardDescription>
            Lecture des factures fournisseurs (PDF, scan, photo) pour pré-remplir la saisie et signaler les anomalies. Désactivée
            par défaut. Lectures ce mois : {used} sur {quota}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset disabled={readOnly}>
            <FieldGroup>
              <FormMessage state={state} />
              <Field orientation="horizontal">
                <input
                  id="ai_enabled"
                  name="ai_enabled"
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setChecked(event.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <FieldContent>
                  <FieldLabel htmlFor="ai_enabled">Activer la lecture des factures par IA</FieldLabel>
                  <FieldDescription>
                    {enabled && consent
                      ? `Activée le ${formatDateTime(consent.at)}${consent.email ? ` par ${consent.email}` : ""}.`
                      : "Proposée sur la page Nouvelle facture aux personnes qui saisissent les factures."}
                  </FieldDescription>
                </FieldContent>
              </Field>
              {checked && !enabled && (
                <Field orientation="horizontal">
                  <input id="ai_consent" name="ai_consent" type="checkbox" className="mt-0.5 size-4 accent-primary" />
                  <FieldContent>
                    <FieldLabel htmlFor="ai_consent">
                      J&apos;accepte que les factures lues soient envoyées à un service d&apos;IA situé hors du Maroc
                    </FieldLabel>
                    <FieldDescription>
                      Service OpenRouter et fournisseurs de modèles (États-Unis, Europe), choisis parmi ceux qui ne conservent pas
                      les documents et ne s&apos;en servent pas pour entraîner leurs modèles. Dans un PDF texte, e-mails,
                      téléphones et RIB sont masqués avant l&apos;envoi ; un scan ou une photo est envoyé tel quel. Ce transfert
                      relève de la loi 09-08 : il doit figurer dans vos déclarations à la CNDP.
                    </FieldDescription>
                    <FieldErrors state={state} name="ai_consent" />
                  </FieldContent>
                </Field>
              )}
              <Field className="max-w-sm">
                <FieldLabel htmlFor="ai_monthly_quota">Lectures par mois au plus</FieldLabel>
                <FormSelect
                  id="ai_monthly_quota"
                  name="ai_monthly_quota"
                  options={quotaChoices.map((count) => ({ value: String(count), label: `${count} factures` }))}
                  defaultValue={String(quota)}
                />
                <FieldDescription>Pour toute l&apos;entreprise, remis à zéro le 1er de chaque mois.</FieldDescription>
              </Field>
            </FieldGroup>
          </fieldset>
        </CardContent>
        {!readOnly && (
          <CardFooter className="justify-end border-t pt-4">
            <SubmitButton>Enregistrer les réglages de l&apos;IA</SubmitButton>
          </CardFooter>
        )}
      </Card>
    </ActionForm>
  );
}
