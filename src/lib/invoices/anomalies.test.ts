import { describe, expect, it } from "vitest";
import { formatMAD } from "@/lib/format";
import type { AiInvoice } from "./ai-reading";
import { type AnomalyContext, detectInvoiceAnomalies } from "./anomalies";

const invoice: AiInvoice = {
  isInvoice: true,
  supplier: { name: "Atlas Matériaux", ice: "001234567000089", taxId: null, tradeRegister: null, city: null },
  customerIce: "002345678000012",
  number: "FA-42",
  issueDate: "2026-10-15",
  dueDate: "2026-12-14",
  deliveryDate: null,
  currency: "MAD",
  amountExclTax: 10000,
  vatAmount: 2000,
  amountInclTax: 12000,
};
const context: AnomalyContext = { duplicate: null, supplierHistory: [], organizationIce: "002345678000012", today: "2026-10-31" };
const messages = (value: AiInvoice, ctx: Partial<AnomalyContext> = {}) => detectInvoiceAnomalies(value, { ...context, ...ctx }).map((a) => a.message);

describe("detectInvoiceAnomalies", () => {
  it("facture cohérente : aucune anomalie", () => {
    expect(detectInvoiceAnomalies(invoice, context)).toEqual([]);
  });

  it("doublon bloquant, et déjà soldé signalé", () => {
    expect(detectInvoiceAnomalies(invoice, { ...context, duplicate: { status: "unpaid" } })).toEqual([
      { level: "error", message: "Facture FA-42 déjà enregistrée pour ce fournisseur." },
    ]);
    expect(messages(invoice, { duplicate: { status: "paid" } })[0]).toContain("déjà soldée");
  });

  it("montant inhabituel par rapport à la médiane des factures du fournisseur", () => {
    expect(messages(invoice, { supplierHistory: [3000, 3500, 4000] })[0]).toBe(
      `Montant inhabituel pour ce fournisseur : ${formatMAD(12000)}, contre ${formatMAD(3500)} d'habitude (médiane de 3 factures).`,
    );
    expect(messages(invoice, { supplierHistory: [100000, 90000, 110000, 95000] })).toHaveLength(1);
    expect(messages(invoice, { supplierHistory: [10000, 15000, 9000] })).toEqual([]);
    // Historique trop court : pas de jugement
    expect(messages(invoice, { supplierHistory: [100, 200] })).toEqual([]);
  });

  it("totaux et taux de TVA incohérents", () => {
    expect(messages({ ...invoice, vatAmount: 2100 })[0]).toContain("Totaux incohérents");
    expect(messages({ ...invoice, vatAmount: 1500, amountInclTax: 11500 })[0]).toContain("Taux de TVA inhabituel (15,00 %)");
    expect(messages({ ...invoice, vatAmount: 1000, amountInclTax: 11000 })).toEqual([]);
  });

  it("dates, devise, ICE et champs manquants", () => {
    expect(
      messages({
        ...invoice,
        isInvoice: false,
        currency: "EUR",
        issueDate: "2026-11-05",
        dueDate: "2026-11-01",
        supplier: { ...invoice.supplier, ice: null },
        customerIce: "009999999000099",
        number: null,
      }),
    ).toEqual([
      "Ce document ne ressemble pas à une facture (devis, bon de livraison, relevé ?).",
      "Facture en EUR : saisissez les montants en dirhams.",
      "Non lu sur la facture : numéro. Complétez le formulaire.",
      "Date de facture dans le futur : vérifiez-la.",
      "Échéance antérieure à la date de facture : vérifiez-les.",
      "ICE du fournisseur non lu : mention obligatoire sur une facture.",
      "Facture adressée à l'ICE 009999999000099, qui n'est pas celui de votre entreprise.",
    ]);
  });
});
