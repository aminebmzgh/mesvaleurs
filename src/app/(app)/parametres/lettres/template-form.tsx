"use client";

import { useActionState, useState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type FormState, initialFormState } from "@/lib/forms";
import { LETTER_VARIABLES, type LetterTemplate, type LetterValues, renderLetterText } from "@/lib/letters/templates";

/** Valeurs d'exemple de l'aperçu. */
const SAMPLE: LetterValues = {
  fournisseur: "Sotrama Matériaux SARL",
  entreprise: "Votre entreprise",
  lieu: "Casablanca",
  date: "28/10/2026",
  reference: "RG-20261028-1006",
  factures: "F-2026-0412, F-2026-0498",
  moyens: "2 chèques",
  total: "58 000,00 DH",
  total_lettres: "cinquante-huit mille dirhams",
  reste_du: "5 600,00 DH",
  signataire: "Karim Benali",
};

export function LetterTemplateForm({
  action,
  template,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  template?: Omit<LetterTemplate, "key">;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [closing, setClosing] = useState(template?.closing ?? "");

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <ActionForm action={formAction} pending={pending} noValidate>
        <Card>
          <CardContent>
            <FieldGroup>
              <FormMessage state={state} />
              <Field>
                <FieldLabel htmlFor="name">Nom du modèle</FieldLabel>
                <Input id="name" name="name" defaultValue={template?.name} maxLength={80} {...invalidProps(state, "name")} />
                <FieldErrors state={state} name="name" />
              </Field>
              <Field>
                <FieldLabel htmlFor="subject">Objet</FieldLabel>
                <Input id="subject" name="subject" value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} {...invalidProps(state, "subject")} />
                <FieldErrors state={state} name="subject" />
              </Field>
              <Field>
                <FieldLabel htmlFor="body">Corps de la lettre</FieldLabel>
                <Textarea id="body" name="body" rows={6} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} {...invalidProps(state, "body")} />
                <FieldDescription>Placé avant les tableaux des factures réglées et des paiements joints.</FieldDescription>
                <FieldErrors state={state} name="body" />
              </Field>
              <Field>
                <FieldLabel htmlFor="closing">Formule de politesse</FieldLabel>
                <Textarea id="closing" name="closing" rows={4} value={closing} maxLength={2000} onChange={(e) => setClosing(e.target.value)} {...invalidProps(state, "closing")} />
                <FieldDescription>Placée après les tableaux, avant la signature et la zone « Reçu par ».</FieldDescription>
                <FieldErrors state={state} name="closing" />
              </Field>
              <div className="flex justify-end">
                <SubmitButton>{submitLabel}</SubmitButton>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>
      </ActionForm>

      <aside className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Variables</CardTitle>
            <CardDescription>Remplacées à la génération de la lettre.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {Object.entries(LETTER_VARIABLES).map(([name, description]) => (
                <div key={name} className="contents">
                  <dt className="font-mono text-xs">{`{${name}}`}</dt>
                  <dd className="text-muted-foreground">{description}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Aperçu</CardTitle>
            <CardDescription>Avec des valeurs d&apos;exemple.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm whitespace-pre-line" aria-label="Aperçu de la lettre">
            <p className="font-medium">Objet : {renderLetterText(subject, SAMPLE)}</p>
            <p>{renderLetterText(body, SAMPLE)}</p>
            <p className="text-xs text-muted-foreground">[Factures réglées · Paiements joints · Total]</p>
            <p>{renderLetterText(closing, SAMPLE)}</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
