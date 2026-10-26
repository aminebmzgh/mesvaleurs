import { describe, expect, it } from "vitest";
import { attachmentPath, invoiceSchema, isAttachmentPathOf } from "./schemas";

const SUPPLIER = "e0000000-0000-4000-8000-000000000001";
const ORG = "b0000000-0000-4000-8000-000000000001";
const INVOICE = "f0000000-0000-4000-8000-000000000001";

const base = { supplier_id: SUPPLIER, number: "F-2026-0412", issue_date: "2026-08-05", amount_incl_tax: "48 000,00" };

describe("invoiceSchema", () => {
  it("accepte une facture minimale", () => {
    const result = invoiceSchema.parse(base);
    expect(result.amount_incl_tax).toBe(48000);
    expect(result.amount_excl_tax ?? null).toBeNull();
    expect(result.payment_terms_days ?? null).toBeNull();
  });

  it("vérifie HT + TVA = TTC au centime près", () => {
    expect(invoiceSchema.safeParse({ ...base, amount_excl_tax: "40 000,00", vat_amount: "8 000,00" }).success).toBe(true);
    expect(
      invoiceSchema.safeParse({ ...base, amount_incl_tax: "8 450,50", amount_excl_tax: "7 682,27", vat_amount: "768,23" })
        .success,
    ).toBe(true);
    const result = invoiceSchema.safeParse({ ...base, amount_excl_tax: "40 000,00", vat_amount: "7 999,99" });
    expect(result.error?.issues[0]).toMatchObject({ message: "HT + TVA doit être égal au montant TTC." });
  });

  it("accepte HT seul ou TVA seule sans contrôle de cohérence", () => {
    expect(invoiceSchema.safeParse({ ...base, amount_excl_tax: "40 000,00" }).success).toBe(true);
  });

  it("refuse un TTC nul, une date manquante ou un fournisseur absent", () => {
    const result = invoiceSchema.safeParse({ supplier_id: "", number: "", issue_date: "", amount_incl_tax: "0" });
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["supplier_id", "number", "issue_date"]),
    );
    expect(invoiceSchema.safeParse({ ...base, amount_incl_tax: "0,00" }).success).toBe(false);
  });
});

describe("pièces jointes", () => {
  it("construit un chemin préfixé par l'organisation et la facture", () => {
    expect(attachmentPath(ORG, INVOICE, "Facture Mars.PDF", "a1b2")).toBe(`${ORG}/${INVOICE}/a1b2.pdf`);
    expect(attachmentPath(ORG, INVOICE, "sans-extension", "a1b2")).toBe(`${ORG}/${INVOICE}/a1b2`);
  });

  it("refuse un chemin d'une autre facture ou une tentative de remontée", () => {
    expect(isAttachmentPathOf(`${ORG}/${INVOICE}/a1b2.pdf`, ORG, INVOICE)).toBe(true);
    expect(isAttachmentPathOf(`${ORG}/f0000000-0000-4000-8000-000000000002/a1b2.pdf`, ORG, INVOICE)).toBe(false);
    expect(isAttachmentPathOf(`${ORG}/${INVOICE}/../../autre.pdf`, ORG, INVOICE)).toBe(false);
  });
});
