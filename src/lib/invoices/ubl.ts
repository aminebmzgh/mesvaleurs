/**
 * Factures électroniques UBL 2.1 (spec §11 bis A) : lecture d'un fichier XML reçu d'un
 * fournisseur et contrôles de cohérence. Fonctions pures, sans accès réseau : les entités
 * externes ne sont jamais résolues. Aucune connexion à la plateforme de la DGI ici ; elle
 * passera par une couche d'intégration distincte, une fois les spécifications publiées.
 */
import { XMLParser } from "fast-xml-parser";
import { daysBetween } from "@/lib/dates";
import { normalizeRib } from "@/lib/rib";

/** Taille maximale d'un fichier UBL. */
export const UBL_MAX_BYTES = 2 * 1024 * 1024;

export type UblParty = {
  name: string;
  ice: string | null;
  taxId: string | null;
  tradeRegister: string | null;
  address: string | null;
  city: string | null;
  rib: string | null;
};

export type UblInvoice = {
  number: string;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  supplier: UblParty;
  customerIce: string | null;
  amountExclTax: number | null;
  vatAmount: number | null;
  amountInclTax: number;
  /** Somme des lignes (contrôle du total HT). */
  linesTotal: number | null;
};

export class UblError extends Error {}

type Node = Record<string, unknown>;

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  trimValues: true,
  processEntities: false,
  isArray: (name) => ["InvoiceLine", "PartyIdentification", "PartyTaxScheme", "PaymentMeans", "TaxTotal"].includes(name),
});

const asArray = (value: unknown): Node[] => (Array.isArray(value) ? value : value == null ? [] : [value]) as Node[];
/** Premier élément au bout du chemin (les éléments répétés sont des tableaux). */
const child = (node: unknown, ...path: string[]): unknown =>
  path.reduce<unknown>((current, key) => {
    const value = current && typeof current === "object" ? (current as Node)[key] : undefined;
    return Array.isArray(value) ? value[0] : value;
  }, node);
/** Texte d'un élément (avec ou sans attributs). */
function text(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "object") {
    return text((value as Node)["#text"]);
  }
  const result = String(value).trim();
  return result === "" ? null : result;
}
const attribute = (value: unknown, name: string) => (value && typeof value === "object" ? text((value as Node)[`@${name}`]) : null);

function amount(value: unknown): number | null {
  const raw = text(value);
  if (raw === null) {
    return null;
  }
  const number = Number(raw);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

function isoDate(value: unknown): string | null {
  const raw = text(value);
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/** Identifiants d'une partie : ICE (15 chiffres), IF, RC, selon l'attribut schemeID ou la forme. */
function identifiers(party: unknown) {
  const ids = [
    ...asArray((party as Node)?.PartyIdentification).map((entry) => (entry as Node).ID),
    ...asArray((party as Node)?.PartyTaxScheme).map((entry) => (entry as Node).CompanyID),
    child(party, "PartyLegalEntity", "CompanyID"),
  ].filter((value) => value != null);
  const find = (scheme: RegExp) => ids.find((value) => scheme.test(attribute(value, "schemeID") ?? ""));
  const ice = text(find(/^ICE$/i)) ?? ids.map(text).find((value) => value !== null && /^\d{15}$/.test(value)) ?? null;
  return {
    ice: ice && /^\d{15}$/.test(ice) ? ice : null,
    taxId: text(find(/^(IF|TAX|VAT)$/i)),
    tradeRegister: text(find(/^RC$/i)),
  };
}

function partyOf(party: unknown, paymentMeans: unknown[]): UblParty {
  const ids = identifiers(party);
  const name = text(child(party, "PartyLegalEntity", "RegistrationName")) ?? text(child(party, "PartyName", "Name"));
  if (!name) {
    throw new UblError("Raison sociale du fournisseur absente du fichier.");
  }
  const street = [text(child(party, "PostalAddress", "StreetName")), text(child(party, "PostalAddress", "AdditionalStreetName"))]
    .filter(Boolean)
    .join(", ");
  const rib = paymentMeans
    .map((means) => text(child(means, "PayeeFinancialAccount", "ID")))
    .map((value) => (value ? normalizeRib(value) : null))
    .find((value) => value !== null && /^\d{24}$/.test(value));
  return {
    name: name.slice(0, 200),
    ...ids,
    address: street || null,
    city: text(child(party, "PostalAddress", "CityName")),
    rib: rib ?? null,
  };
}

/** Lit une facture UBL 2.1. Un avoir (CreditNote) ou un fichier d'un autre format est refusé. */
export function parseUbl(xml: string): UblInvoice {
  if (xml.length > UBL_MAX_BYTES) {
    throw new UblError("Fichier trop volumineux.");
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new UblError("Fichier refusé : déclarations DOCTYPE ou ENTITY interdites.");
  }
  let document: Node;
  try {
    document = parser.parse(xml) as Node;
  } catch {
    throw new UblError("Fichier XML illisible.");
  }
  if ("CreditNote" in document) {
    throw new UblError("Avoir (CreditNote) : non pris en charge, saisissez-le manuellement.");
  }
  const invoice = document.Invoice as Node | undefined;
  if (!invoice) {
    throw new UblError("Ce fichier n'est pas une facture UBL (élément Invoice absent).");
  }
  const number = text(invoice.ID);
  const issueDate = isoDate(invoice.IssueDate);
  if (!number || !issueDate) {
    throw new UblError("Numéro ou date de facture absents du fichier.");
  }
  const currency = text(invoice.DocumentCurrencyCode) ?? "MAD";
  const paymentMeans = asArray(invoice.PaymentMeans);
  const totals = child(invoice, "LegalMonetaryTotal");
  const inclTax = amount(child(totals, "TaxInclusiveAmount")) ?? amount(child(totals, "PayableAmount"));
  if (inclTax === null) {
    throw new UblError("Montant TTC absent du fichier.");
  }
  const lines = asArray(invoice.InvoiceLine).map((line) => amount(line.LineExtensionAmount));
  return {
    number: number.slice(0, 60),
    issueDate,
    dueDate: isoDate(invoice.DueDate) ?? paymentMeans.map((means) => isoDate(means.PaymentDueDate)).find(Boolean) ?? null,
    currency,
    supplier: partyOf(child(invoice, "AccountingSupplierParty", "Party"), paymentMeans),
    customerIce: identifiers(child(invoice, "AccountingCustomerParty", "Party")).ice,
    amountExclTax: amount(child(totals, "TaxExclusiveAmount")) ?? amount(child(totals, "LineExtensionAmount")),
    vatAmount: asArray(invoice.TaxTotal).map((total) => amount(total.TaxAmount)).find((value) => value !== null) ?? null,
    amountInclTax: inclTax,
    linesTotal: lines.length > 0 && lines.every((value) => value !== null) ? lines.reduce<number>((sum, value) => sum + Math.round(value! * 100), 0) / 100 : null,
  };
}

export type UblCheck = { level: "error" | "warning"; message: string };

const cents = (value: number) => Math.round(value * 100);

/**
 * Contrôles de cohérence : devise, totaux, ICE du fournisseur et de notre entreprise,
 * facture déjà enregistrée. Une erreur bloque l'import ; un avertissement est affiché.
 */
export function checkUbl(invoice: UblInvoice, { organizationIce, duplicate }: { organizationIce: string | null; duplicate: boolean }): UblCheck[] {
  const checks: UblCheck[] = [];
  if (invoice.currency !== "MAD") {
    checks.push({ level: "error", message: `Devise ${invoice.currency} : seules les factures en dirhams (MAD) sont acceptées.` });
  }
  if (invoice.amountInclTax <= 0) {
    checks.push({ level: "error", message: "Montant TTC nul ou négatif." });
  }
  if (duplicate) {
    checks.push({ level: "error", message: `Facture ${invoice.number} déjà enregistrée pour ce fournisseur.` });
  }
  if (invoice.amountExclTax !== null && invoice.vatAmount !== null && cents(invoice.amountExclTax) + cents(invoice.vatAmount) !== cents(invoice.amountInclTax)) {
    checks.push({ level: "error", message: "Totaux incohérents : HT + TVA différent du TTC." });
  }
  if (invoice.linesTotal !== null && invoice.amountExclTax !== null && cents(invoice.linesTotal) !== cents(invoice.amountExclTax)) {
    checks.push({ level: "warning", message: "La somme des lignes diffère du total HT (remises ou frais au niveau de la facture ?)." });
  }
  if (!invoice.supplier.ice) {
    checks.push({ level: "warning", message: "ICE du fournisseur absent du fichier." });
  }
  if (organizationIce && invoice.customerIce && invoice.customerIce !== organizationIce) {
    checks.push({ level: "warning", message: `Facture adressée à l'ICE ${invoice.customerIce}, qui n'est pas celui de votre entreprise.` });
  }
  return checks;
}

/** Délai convenu déduit de l'échéance indiquée dans le fichier (0 à 365 jours). */
export function paymentTermsDays(invoice: Pick<UblInvoice, "issueDate" | "dueDate">): number | null {
  if (!invoice.dueDate) {
    return null;
  }
  const days = daysBetween(invoice.issueDate, invoice.dueDate);
  return days >= 0 && days <= 365 ? days : null;
}
