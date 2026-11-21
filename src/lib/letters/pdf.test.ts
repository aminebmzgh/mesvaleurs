import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { CoverLetterData } from "./data";
import { coverLetterPdf, letterValues, remittanceSlipPdf } from "./pdf";
import { BUILTIN_LETTER_TEMPLATES } from "./templates";

const base: CoverLetterData = {
  organization: { name: "Atlas Distribution SARL", address: "45, bd Zerktouni", city: "Casablanca", phone: null, email: null, ice: "001122334000055", taxId: null, tradeRegister: null, logo: null },
  supplier: { name: "Maghreb Emballages SA", address: null, city: "Tanger", ice: null },
  signer: { name: "Salma El Idrissi", jobTitle: "Responsable administratif et financier" },
  place: "Casablanca",
  issueDate: "2026-07-21",
  reference: "RG-20260721-5000100",
  invoices: [{ number: "ME/26/1187", issueDate: "2026-07-20", amountInclTax: 120000, settled: 120000, remaining: 0 }],
  instruments: [
    { label: "LCN 5000100", bank: "Banque Populaire", amount: 40000, dueDate: "2026-08-20" },
    { label: "LCN 5000101", bank: "Banque Populaire", amount: 40000, dueDate: "2026-11-18" },
    { label: "LCN 5000102", bank: "Banque Populaire", amount: 40000, dueDate: "2026-12-18" },
  ],
  total: 120000,
  remaining: 0,
  hasLcn: true,
  printCoverLetter: true,
};

const pages = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe("letterValues", () => {
  it("moyens joints et total en lettres sans majuscule initiale", () => {
    const values = letterValues(base, false);
    expect(values.moyens).toBe("3 LCN");
    expect(values.total_lettres).toBe("cent vingt mille dirhams");
    expect(values.factures).toBe("ME/26/1187");
    expect(letterValues({ ...base, instruments: [{ label: "Chèque 0001006", bank: "", amount: 1, dueDate: null }] }, false).moyens).toBe("1 chèque");
  });
});

describe("coverLetterPdf", () => {
  it("une page par exemplaire", async () => {
    expect(await pages(await coverLetterPdf(base, BUILTIN_LETTER_TEMPLATES[1]))).toBe(1);
    expect(await pages(await coverLetterPdf(base, BUILTIN_LETTER_TEMPLATES[1], { copies: 2 }))).toBe(2);
  });

  it("QR code du portail sur l'exemplaire fournisseur, toujours sur une page", async () => {
    const portalUrl = `https://mesvaleurs.ma/suivi/${"Ab_-".repeat(8)}`;
    expect(await pages(await coverLetterPdf({ ...base, portalUrl }, BUILTIN_LETTER_TEMPLATES[1]))).toBe(1);
    expect(await pages(await coverLetterPdf({ ...base, portalUrl }, BUILTIN_LETTER_TEMPLATES[1], { copies: 2 }))).toBe(2);
  });

  it("pagine une longue liste de factures", async () => {
    const invoices = Array.from({ length: 60 }, (_, i) => ({ number: `F-${i}`, issueDate: "2026-07-01", amountInclTax: 100, settled: 100, remaining: 0 }));
    expect(await pages(await coverLetterPdf({ ...base, invoices }, BUILTIN_LETTER_TEMPLATES[0]))).toBeGreaterThan(1);
  });

  it("logo illisible : lettre générée sans logo", async () => {
    const bytes = await coverLetterPdf({ ...base, organization: { ...base.organization, logo: { bytes: new Uint8Array([1, 2, 3]), type: "png" } } }, BUILTIN_LETTER_TEMPLATES[0]);
    expect(await pages(bytes)).toBe(1);
  });
});

describe("remittanceSlipPdf", () => {
  it("bordereau en deux exemplaires sur une page", async () => {
    expect(await pages(await remittanceSlipPdf(base))).toBe(1);
  });
});
