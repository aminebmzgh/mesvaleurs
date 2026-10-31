import { describe, expect, it } from "vitest";
import { aiPaymentTermsDays, AiReadingError, parseAiInvoice } from "./ai-reading";

const response = {
  is_invoice: true,
  supplier_name: "  Atlas   Matériaux SARL ",
  supplier_ice: "001 234 567 000 089",
  supplier_tax_id: "12345678",
  supplier_trade_register: "RC 98765",
  supplier_city: "Casablanca",
  customer_ice: "002345678000012",
  number: "FA-2026-0042",
  issue_date: "2026-10-15",
  due_date: "2026-12-14",
  delivery_date: null,
  currency: "DH",
  amount_excl_tax: 10288,
  vat_amount: 2057.6,
  amount_incl_tax: 12345.6,
};

describe("parseAiInvoice", () => {
  it("lit la réponse du modèle et normalise les valeurs", () => {
    expect(parseAiInvoice(JSON.stringify(response))).toEqual({
      isInvoice: true,
      supplier: { name: "Atlas Matériaux SARL", ice: "001234567000089", taxId: "12345678", tradeRegister: "RC 98765", city: "Casablanca" },
      customerIce: "002345678000012",
      number: "FA-2026-0042",
      issueDate: "2026-10-15",
      dueDate: "2026-12-14",
      deliveryDate: null,
      currency: "MAD",
      amountExclTax: 10288,
      vatAmount: 2057.6,
      amountInclTax: 12345.6,
    });
  });

  it("ramène à null les valeurs invalides, une à une", () => {
    const invoice = parseAiInvoice(
      JSON.stringify({ ...response, supplier_ice: "12345", issue_date: "2026-02-30", due_date: "15/10/2026", amount_excl_tax: -5, vat_amount: "20", number: "  " }),
    );
    expect(invoice).toMatchObject({ supplier: { ice: null }, issueDate: null, dueDate: null, number: null });
    // HT et TVA illisibles : TTC seul conservé
    expect(invoice).toMatchObject({ amountExclTax: null, vatAmount: null, amountInclTax: 12345.6 });
  });

  it("déduit le total manquant des deux autres", () => {
    expect(parseAiInvoice(JSON.stringify({ ...response, amount_incl_tax: null })).amountInclTax).toBe(12345.6);
    expect(parseAiInvoice(JSON.stringify({ ...response, amount_excl_tax: null })).amountExclTax).toBe(10288);
    expect(parseAiInvoice(JSON.stringify({ ...response, vat_amount: null })).vatAmount).toBe(2057.6);
  });

  it("accepte un JSON entouré d'un bloc de code", () => {
    expect(parseAiInvoice("```json\n" + JSON.stringify(response) + "\n```").number).toBe("FA-2026-0042");
  });

  it("refuse une réponse qui n'est pas un objet JSON", () => {
    expect(() => parseAiInvoice("Voici la facture : …")).toThrow(AiReadingError);
    expect(() => parseAiInvoice("[1, 2]")).toThrow(AiReadingError);
  });
});

describe("aiPaymentTermsDays", () => {
  it("délai entre la date et l'échéance, entre 0 et 365 jours", () => {
    expect(aiPaymentTermsDays({ issueDate: "2026-10-15", dueDate: "2026-12-14" })).toBe(60);
    expect(aiPaymentTermsDays({ issueDate: "2026-10-15", dueDate: "2026-10-01" })).toBeNull();
    expect(aiPaymentTermsDays({ issueDate: "2026-10-15", dueDate: null })).toBeNull();
  });
});
