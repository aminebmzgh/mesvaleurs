"use client";

import { useActionState, useState } from "react";
import { ActionForm, FieldErrors, FormMessage, invalidProps, SubmitButton } from "@/components/forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type FormState, initialFormState } from "@/lib/forms";
import {
  LETTER_KIND_VARIABLES,
  type LetterKind,
  type LetterTemplate,
  type LetterValuesOf,
  renderLetterText,
} from "@/lib/letters/templates";

const COMMON = { entreprise: "Votre entreprise", lieu: "Casablanca", date: "28/10/2026", signataire: "Karim Benali" };

/** Valeurs d'exemple de l'aperçu, par type de courrier. */
const SAMPLES: { [K in LetterKind]: LetterValuesOf<K> } = {
  cover_letter: {
    ...COMMON,
    fournisseur: "Sotrama Matériaux SARL",
    reference: "RG-20261028-1006",
    factures: "F-2026-0412, F-2026-0498",
    moyens: "2 chèques",
    total: "58 000,00 DH",
    total_lettres: "cinquante-huit mille dirhams",
    reste_du: "5 600,00 DH",
  },
  opposition: {
    ...COMMON,
    reference: "OP-20261028-1003",
    banque: "Attijariwafa bank",
    agence: "Casablanca Anfa",
    compte: "Compte courant",
    rib: "007780000123456789012345",
    valeurs: "le chèque n° 0001003 d'un montant de 8 450,50 DH à l'ordre de ATLAS TRANSPORT",
    motif: "perte",
    date_constat: "27/10/2026",
    recepisse: "PV n° 1234/2026",
  },
  postponement_request: {
    ...COMMON,
    reference: "PR-20261028-5000101",
    fournisseur: "Maghreb Emballages SA",
    valeur: "LCN n° 5000101",
    montant: "40 000,00 DH",
    echeance: "18/11/2026",
    nouvelle_echeance: "18/12/2026",
    motif: "décalage de trésorerie",
  },
  statement_request: {
    ...COMMON,
    reference: "RC-20261028",
    fournisseur: "Sotrama Matériaux SARL",
    date_arrete: "31/10/2026",
    solde: "15 600,00 DH",
  },
  reminder: {
    ...COMMON,
    reference: "RL-20261028",
    destinataire: "Comptoir du Nord SARL",
    factures: "la facture n° V-2026-114 du 15/09/2026",
    montant_du: "12 000,00 DH",
    date_limite: "05/11/2026",
  },
};

/** Emplacement du tableau des valeurs dans la lettre, par type de courrier. */
const TABLE_HINT: Record<LetterKind, string | null> = {
  cover_letter: "[Factures réglées · Paiements joints · Total]",
  opposition: "[Valeurs en opposition]",
  postponement_request: "[LCN concernée : échéance actuelle et demandée]",
  statement_request: "[Factures non soldées selon vos livres]",
  reminder: null,
};

export function LetterTemplateForm({
  action,
  kind,
  template,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  kind: LetterKind;
  template?: Omit<LetterTemplate, "key">;
  submitLabel: string;
}) {
  const sample: Record<string, string> = SAMPLES[kind];
  const hint = TABLE_HINT[kind];
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
              <input type="hidden" name="kind" value={kind} />
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
                <FieldDescription>{hint ? "Placé avant le tableau des valeurs." : "Placé après l'objet."}</FieldDescription>
                <FieldErrors state={state} name="body" />
              </Field>
              <Field>
                <FieldLabel htmlFor="closing">Formule de politesse</FieldLabel>
                <Textarea id="closing" name="closing" rows={4} value={closing} maxLength={2000} onChange={(e) => setClosing(e.target.value)} {...invalidProps(state, "closing")} />
                <FieldDescription>Placée {hint ? "après le tableau, " : ""}avant la signature.</FieldDescription>
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
              {Object.entries(LETTER_KIND_VARIABLES[kind]).map(([name, description]) => (
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
            <p className="font-medium">Objet : {renderLetterText(subject, sample)}</p>
            <p>{renderLetterText(body, sample)}</p>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            <p>{renderLetterText(closing, sample)}</p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
