/**
 * Modèles de lettre d'accompagnement de règlement (spec §6.4 bis) : texte libre avec
 * variables entre accolades, remplacées à la génération du PDF.
 */

export type LetterTemplate = {
  /** Identifiant stable d'un modèle intégré, ou identifiant d'un modèle de l'entreprise. */
  key: string;
  name: string;
  subject: string;
  /** Corps de la lettre, avant les tableaux des factures et des paiements. */
  body: string;
  /** Formule de politesse, après les tableaux. */
  closing: string;
};

export const LETTER_VARIABLES = {
  fournisseur: "Raison sociale du fournisseur",
  entreprise: "Raison sociale de votre entreprise",
  lieu: "Lieu d'émission",
  date: "Date d'émission",
  reference: "Référence interne du règlement",
  factures: "Numéros des factures réglées",
  moyens: "Moyens de paiement joints (ex. « 2 chèques »)",
  total: "Total réglé en chiffres",
  total_lettres: "Total réglé en lettres",
  reste_du: "Reste à payer sur les factures réglées",
  signataire: "Nom du signataire",
} as const;

export type LetterVariable = keyof typeof LETTER_VARIABLES;
export type LetterValues = Record<LetterVariable, string>;

/** Remplace les variables connues ; une variable inconnue reste visible pour être corrigée. */
export function renderLetterText(text: string, values: LetterValues): string {
  return text.replace(/\{([a-z_]+)\}/g, (match, name: string) =>
    name in values ? values[name as LetterVariable] : match,
  );
}

const CLOSING =
  "Nous vous remercions de bien vouloir nous retourner le présent courrier signé en guise d'accusé de réception.\n\nVeuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.";

export const BUILTIN_LETTER_TEMPLATES: LetterTemplate[] = [
  {
    key: "standard",
    name: "Règlement standard",
    subject: "Règlement de facture(s) — {reference}",
    body: "Madame, Monsieur,\n\nNous avons le plaisir de vous adresser ci-joint {moyens} d'un montant total de {total} ({total_lettres}), en règlement des factures détaillées ci-dessous.",
    closing: CLOSING,
  },
  {
    key: "lcn",
    name: "LCN échelonnées",
    subject: "Règlement par lettres de change normalisées — {reference}",
    body: "Madame, Monsieur,\n\nVeuillez trouver ci-joint {moyens} d'un montant total de {total} ({total_lettres}), aux échéances indiquées ci-dessous, en règlement des factures détaillées.",
    closing: CLOSING,
  },
  {
    key: "acompte",
    name: "Acompte",
    subject: "Acompte sur facture(s) — {reference}",
    body: "Madame, Monsieur,\n\nNous vous adressons ci-joint {moyens} d'un montant de {total} ({total_lettres}) à titre d'acompte sur les factures ci-dessous. Le reste à payer s'élève à {reste_du}.",
    closing: CLOSING,
  },
  {
    key: "solde",
    name: "Solde",
    subject: "Solde de facture(s) — {reference}",
    body: "Madame, Monsieur,\n\nVeuillez trouver ci-joint {moyens} d'un montant de {total} ({total_lettres}) pour solde des factures ci-dessous.",
    closing: CLOSING,
  },
];

/** Modèle proposé par défaut selon le règlement : LCN, acompte (reste dû) ou standard. */
export function suggestedTemplateKey({ hasLcn, remainingCents }: { hasLcn: boolean; remainingCents: number }): string {
  if (remainingCents > 0) {
    return "acompte";
  }
  return hasLcn ? "lcn" : "standard";
}
