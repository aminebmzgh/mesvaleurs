/**
 * Courriers types : des données métier aux textes et tableaux mis en page
 * (variables remplacées dans le modèle choisi). Sans accès à la base.
 */

import { formatInstrumentNumber } from "@/lib/checkbooks";
import { formatDate, formatMAD } from "@/lib/format";
import { LEGAL_DISCLAIMER, STOP_ORDER_REASON_LABELS, type StopOrderReason } from "@/lib/labels";
import type { LetterOrganization, LetterSigner } from "./data";
import type { LetterDocument } from "./pdf";
import { type LetterKind, type LetterTemplate, type LetterValuesOf, renderLetterText } from "./templates";

export type Letterhead = { organization: LetterOrganization; signer: LetterSigner };

type Common = Letterhead & { place: string; date: string; reference: string };

function commonValues(data: Common) {
  return {
    entreprise: data.organization.name,
    lieu: data.place,
    date: formatDate(data.date),
    reference: data.reference,
    signataire: data.signer.name,
  };
}

function render<K extends LetterKind>(template: LetterTemplate, values: LetterValuesOf<K>) {
  return {
    subject: renderLetterText(template.subject, values),
    body: renderLetterText(template.body, values),
    closing: renderLetterText(template.closing, values),
  };
}

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase("fr") + text.slice(1);

// -----------------------------------------------------------------------------
// Lettre d'opposition (à la banque)
// -----------------------------------------------------------------------------

export type OppositionData = Common & {
  bank: { name: string; branch: string | null; accountLabel: string; rib: string | null };
  reason: StopOrderReason;
  occurredOn: string;
  policeReport: string | null;
  instrument: "check" | "lcn";
  numberWidth: number;
  /** Paiement émis en opposition, ou formules vierges first à last. */
  payment: { type: "check" | "lcn" | "guarantee_check"; number: number; payee: string; amount: number; issueDate: string } | null;
  firstNumber: number;
  lastNumber: number;
};

/** Désignation des valeurs en opposition, en milieu de phrase. */
export function oppositionSubjectLine(data: OppositionData): string {
  const number = (n: number) => formatInstrumentNumber(n, data.numberWidth);
  const lcn = data.instrument === "lcn";
  if (data.payment) {
    return `${lcn ? "la LCN" : "le chèque"} n° ${number(data.payment.number)} d'un montant de ${formatMAD(data.payment.amount)} à l'ordre de ${data.payment.payee}`;
  }
  const form = lcn ? "LCN" : "chèque";
  return data.firstNumber === data.lastNumber
    ? `la formule de ${form} vierge n° ${number(data.firstNumber)}`
    : `les formules de ${form} vierges n° ${number(data.firstNumber)} à ${number(data.lastNumber)} (${data.lastNumber - data.firstNumber + 1} formules)`;
}

export function oppositionValues(data: OppositionData): LetterValuesOf<"opposition"> {
  return {
    ...commonValues(data),
    banque: data.bank.name,
    agence: data.bank.branch || "—",
    compte: data.bank.accountLabel,
    rib: data.bank.rib ?? "—",
    valeurs: oppositionSubjectLine(data),
    motif: lowerFirst(STOP_ORDER_REASON_LABELS[data.reason]),
    date_constat: formatDate(data.occurredOn),
    recepisse: data.policeReport || "références à compléter",
  };
}

export function oppositionDocument(data: OppositionData, template: LetterTemplate): LetterDocument {
  const number = (n: number) => formatInstrumentNumber(n, data.numberWidth);
  const kind = data.instrument === "lcn" ? "LCN" : "Chèque";
  const row = data.payment
    ? [`${kind} n° ${number(data.payment.number)}`, data.payment.payee, formatDate(data.payment.issueDate), formatMAD(data.payment.amount)]
    : [
        data.firstNumber === data.lastNumber ? `Formule n° ${number(data.firstNumber)}` : `Formules n° ${number(data.firstNumber)} à ${number(data.lastNumber)}`,
        "Formule(s) vierge(s)",
        "—",
        "—",
      ];
  return {
    title: `Lettre d'opposition ${data.reference}`,
    organization: data.organization,
    signer: data.signer,
    recipient: { name: data.bank.name, lines: [data.bank.branch ? `Agence ${data.bank.branch}` : "", "Service des oppositions"] },
    place: data.place,
    date: data.date,
    reference: data.reference,
    ...render<"opposition">(template, oppositionValues(data)),
    table: {
      title: "Valeurs en opposition",
      columns: [
        { header: "Valeur", width: 165 },
        { header: "Bénéficiaire", width: 160 },
        { header: "Émise le", width: 75 },
        { header: "Montant", width: 95, align: "right" },
      ],
      rows: [row],
    },
    notice: LEGAL_DISCLAIMER,
  };
}

// -----------------------------------------------------------------------------
// Demande de prorogation d'une LCN (au fournisseur)
// -----------------------------------------------------------------------------

export type PostponementRequestData = Common & {
  supplier: { name: string; lines: string[] };
  lcn: { number: number; numberWidth: number; amount: number; bank: string; dueDate: string };
  newDueDate: string;
  reason: string;
};

export function postponementRequestValues(data: PostponementRequestData): LetterValuesOf<"postponement_request"> {
  return {
    ...commonValues(data),
    fournisseur: data.supplier.name,
    valeur: `LCN n° ${formatInstrumentNumber(data.lcn.number, data.lcn.numberWidth)}`,
    montant: formatMAD(data.lcn.amount),
    echeance: formatDate(data.lcn.dueDate),
    nouvelle_echeance: formatDate(data.newDueDate),
    motif: data.reason || "décalage de trésorerie",
  };
}

export function postponementRequestDocument(data: PostponementRequestData, template: LetterTemplate): LetterDocument {
  return {
    title: `Demande de prorogation ${data.reference}`,
    organization: data.organization,
    signer: data.signer,
    recipient: data.supplier,
    place: data.place,
    date: data.date,
    reference: data.reference,
    ...render<"postponement_request">(template, postponementRequestValues(data)),
    table: {
      title: "LCN concernée",
      columns: [
        { header: "LCN", width: 90 },
        { header: "Banque", width: 120 },
        { header: "Échéance actuelle", width: 95 },
        { header: "Échéance demandée", width: 100 },
        { header: "Montant", width: 90, align: "right" },
      ],
      rows: [
        [
          `n° ${formatInstrumentNumber(data.lcn.number, data.lcn.numberWidth)}`,
          data.lcn.bank,
          formatDate(data.lcn.dueDate),
          formatDate(data.newDueDate),
          formatMAD(data.lcn.amount),
        ],
      ],
    },
    counterpart: "Bon pour accord du fournisseur (date, signature et cachet)",
  };
}

// -----------------------------------------------------------------------------
// Demande de relevé de compte (au fournisseur)
// -----------------------------------------------------------------------------

export type StatementRequestData = Common & {
  supplier: { name: string; lines: string[] };
  asOf: string;
  /** Factures non soldées selon nos livres. */
  invoices: { number: string; issueDate: string; amountInclTax: number; remaining: number }[];
};

const sumCents = (values: number[]) => values.reduce((sum, v) => sum + Math.round(v * 100), 0) / 100;

export function statementRequestValues(data: StatementRequestData): LetterValuesOf<"statement_request"> {
  return {
    ...commonValues(data),
    fournisseur: data.supplier.name,
    date_arrete: formatDate(data.asOf),
    solde: formatMAD(sumCents(data.invoices.map((i) => i.remaining))),
  };
}

export function statementRequestDocument(data: StatementRequestData, template: LetterTemplate): LetterDocument {
  return {
    title: `Demande de relevé de compte ${data.reference}`,
    organization: data.organization,
    signer: data.signer,
    recipient: data.supplier,
    place: data.place,
    date: data.date,
    reference: data.reference,
    ...render<"statement_request">(template, statementRequestValues(data)),
    table:
      data.invoices.length > 0
        ? {
            title: "Factures non soldées selon nos livres",
            columns: [
              { header: "Facture", width: 175 },
              { header: "Date", width: 90 },
              { header: "Montant TTC", width: 115, align: "right" },
              { header: "Reste dû", width: 115, align: "right" },
            ],
            rows: data.invoices.map((i) => [i.number, formatDate(i.issueDate), formatMAD(i.amountInclTax), formatMAD(i.remaining)]),
            footer: ["Solde", "", "", formatMAD(sumCents(data.invoices.map((i) => i.remaining)))],
          }
        : undefined,
  };
}

// -----------------------------------------------------------------------------
// Lettre de relance (à un client)
// -----------------------------------------------------------------------------

export type ReminderData = Common & {
  customer: { name: string; lines: string[] };
  invoices: string;
  amountDue: number;
  deadline: string;
};

export function reminderValues(data: ReminderData): LetterValuesOf<"reminder"> {
  return {
    ...commonValues(data),
    destinataire: data.customer.name,
    factures: data.invoices,
    montant_du: formatMAD(data.amountDue),
    date_limite: formatDate(data.deadline),
  };
}

export function reminderDocument(data: ReminderData, template: LetterTemplate): LetterDocument {
  return {
    title: `Relance ${data.reference}`,
    organization: data.organization,
    signer: data.signer,
    recipient: data.customer,
    place: data.place,
    date: data.date,
    reference: data.reference,
    ...render<"reminder">(template, reminderValues(data)),
  };
}
