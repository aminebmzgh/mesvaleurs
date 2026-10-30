/**
 * Courriers types (spec §6.4 bis et §11 bis D) : texte libre avec variables entre
 * accolades, remplacées à la génération du PDF. Chaque type de courrier a ses
 * variables et ses modèles intégrés ; l'entreprise peut ajouter les siens.
 */

import type { Database } from "@/types/database";

export type LetterKind = Database["public"]["Enums"]["letter_kind"];

export type LetterTemplate = {
  /** Identifiant stable d'un modèle intégré, ou identifiant d'un modèle de l'entreprise. */
  key: string;
  name: string;
  subject: string;
  /** Corps de la lettre, avant le tableau des valeurs (factures, paiements…). */
  body: string;
  /** Formule de politesse, après le tableau. */
  closing: string;
};

export const LETTER_KIND_LABELS: Record<LetterKind, string> = {
  cover_letter: "Lettre d'accompagnement de règlement",
  opposition: "Lettre d'opposition",
  postponement_request: "Demande de prorogation d'une LCN",
  statement_request: "Demande de relevé de compte",
  reminder: "Lettre de relance",
};

export const LETTER_KIND_DESCRIPTIONS: Record<LetterKind, string> = {
  cover_letter: "Jointe aux chèques et LCN remis au fournisseur, depuis la page d'un lot.",
  opposition: "Confirmation écrite de l'opposition à la banque, depuis la liste des paiements ou le compte bancaire.",
  postponement_request: "Adressée au fournisseur avant le report d'une LCN, depuis la liste des paiements.",
  statement_request: "Adressée au fournisseur pour rapprocher les comptes, depuis la fiche du fournisseur.",
  reminder: "Relance d'un client pour une facture impayée, depuis la page Courriers types.",
};

const COMMON_VARIABLES = {
  entreprise: "Raison sociale de votre entreprise",
  lieu: "Lieu d'émission",
  date: "Date de la lettre",
  reference: "Référence de la lettre",
  signataire: "Nom du signataire",
};

export const LETTER_KIND_VARIABLES = {
  cover_letter: {
    fournisseur: "Raison sociale du fournisseur",
    entreprise: COMMON_VARIABLES.entreprise,
    lieu: COMMON_VARIABLES.lieu,
    date: "Date d'émission",
    reference: "Référence interne du règlement",
    factures: "Numéros des factures réglées",
    moyens: "Moyens de paiement joints (ex. « 2 chèques »)",
    total: "Total réglé en chiffres",
    total_lettres: "Total réglé en lettres",
    reste_du: "Reste à payer sur les factures réglées",
    signataire: COMMON_VARIABLES.signataire,
  },
  opposition: {
    ...COMMON_VARIABLES,
    banque: "Nom de la banque",
    agence: "Agence du compte",
    compte: "Intitulé du compte",
    rib: "RIB du compte",
    valeurs: "Valeurs en opposition (ex. « le chèque n° 0001003… »)",
    motif: "Motif de l'opposition (perte, vol…)",
    date_constat: "Date de la perte ou du vol constaté",
    recepisse: "Références du récépissé de déclaration",
  },
  postponement_request: {
    ...COMMON_VARIABLES,
    fournisseur: "Raison sociale du fournisseur",
    valeur: "LCN concernée (ex. « LCN n° 5000101 »)",
    montant: "Montant de la LCN",
    echeance: "Échéance actuelle",
    nouvelle_echeance: "Échéance demandée",
    motif: "Motif de la demande",
  },
  statement_request: {
    ...COMMON_VARIABLES,
    fournisseur: "Raison sociale du fournisseur",
    date_arrete: "Date d'arrêté du relevé demandé",
    solde: "Solde restant dû selon vos livres",
  },
  reminder: {
    ...COMMON_VARIABLES,
    destinataire: "Nom du client",
    factures: "Factures concernées",
    montant_du: "Montant restant dû",
    date_limite: "Date limite de règlement",
  },
} as const satisfies Record<LetterKind, Record<string, string>>;

export type LetterVariables<K extends LetterKind> = keyof (typeof LETTER_KIND_VARIABLES)[K];
export type LetterValuesOf<K extends LetterKind> = Record<LetterVariables<K>, string>;

/** Variables de la lettre d'accompagnement (premier type de courrier). */
export const LETTER_VARIABLES = LETTER_KIND_VARIABLES.cover_letter;
export type LetterVariable = LetterVariables<"cover_letter">;
export type LetterValues = LetterValuesOf<"cover_letter">;

/** Remplace les variables connues ; une variable inconnue reste visible pour être corrigée. */
export function renderLetterText(text: string, values: Record<string, string>): string {
  return text.replace(/\{([a-z_]+)\}/g, (match, name: string) => (Object.hasOwn(values, name) ? values[name] : match));
}

const POLITENESS = "Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.";

const CLOSING = `Nous vous remercions de bien vouloir nous retourner le présent courrier signé en guise d'accusé de réception.\n\n${POLITENESS}`;

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

/** Modèles intégrés, par type de courrier. */
export const BUILTIN_TEMPLATES: Record<LetterKind, LetterTemplate[]> = {
  cover_letter: BUILTIN_LETTER_TEMPLATES,
  opposition: [
    {
      key: "opposition",
      name: "Opposition au paiement",
      subject: "Opposition au paiement — compte {rib}",
      body: "Madame, Monsieur,\n\nNous vous confirmons par la présente faire opposition sur {valeurs}, de notre compte « {compte} » ouvert dans vos livres (agence {agence}, RIB {rib}), pour le motif suivant : {motif}, constaté(e) le {date_constat}.\n\nNous vous prions de bien vouloir enregistrer cette opposition et de refuser le paiement des valeurs détaillées ci-dessous si elles vous étaient présentées.",
      closing: `Le récépissé de la déclaration effectuée auprès des autorités ({recepisse}) est tenu à votre disposition.\n\n${POLITENESS}`,
    },
  ],
  postponement_request: [
    {
      key: "prorogation",
      name: "Demande de prorogation",
      subject: "Demande de prorogation d'échéance — {valeur}",
      body: "Madame, Monsieur,\n\nNous vous prions de bien vouloir accepter la prorogation de l'échéance de la {valeur} d'un montant de {montant}, initialement fixée au {echeance}, au {nouvelle_echeance}.\n\nMotif : {motif}.",
      closing: `En cas d'accord, nous vous remercions de nous retourner le présent courrier revêtu de votre signature et de votre cachet.\n\n${POLITENESS}`,
    },
  ],
  statement_request: [
    {
      key: "releve",
      name: "Demande de relevé de compte",
      subject: "Demande de relevé de compte au {date_arrete}",
      body: "Madame, Monsieur,\n\nAfin de rapprocher nos comptes, nous vous prions de bien vouloir nous adresser le relevé de notre compte dans vos livres, arrêté au {date_arrete}, détaillant les factures émises, les règlements reçus et le solde.\n\nSelon nos livres, le solde restant dû à cette date s'élève à {solde}.",
      closing: `Nous vous remercions par avance de votre diligence.\n\n${POLITENESS}`,
    },
  ],
  reminder: [
    {
      key: "relance",
      name: "Relance de paiement",
      subject: "Relance — règlement de {factures}",
      body: "Madame, Monsieur,\n\nSauf erreur ou omission de notre part, nous restons dans l'attente du règlement de {factures}, d'un montant restant dû de {montant_du}.\n\nNous vous remercions de bien vouloir procéder à ce règlement au plus tard le {date_limite}.",
      closing: `Si votre règlement nous est parvenu entre-temps, nous vous prions de ne pas tenir compte du présent courrier.\n\n${POLITENESS}`,
    },
  ],
};

/** Modèle proposé dans une liste de choix : de l'entreprise ou intégré. */
export type TemplateOption = { key: string; name: string; custom: boolean };

/** Modèle intégré d'une clé, tous types confondus. */
export function findBuiltinTemplate(key: string): (LetterTemplate & { kind: LetterKind }) | null {
  for (const [kind, templates] of Object.entries(BUILTIN_TEMPLATES) as [LetterKind, LetterTemplate[]][]) {
    const template = templates.find((t) => t.key === key);
    if (template) {
      return { ...template, kind };
    }
  }
  return null;
}

/** Modèle proposé par défaut selon le règlement : LCN, acompte (reste dû) ou standard. */
export function suggestedTemplateKey({ hasLcn, remainingCents }: { hasLcn: boolean; remainingCents: number }): string {
  if (remainingCents > 0) {
    return "acompte";
  }
  return hasLcn ? "lcn" : "standard";
}
