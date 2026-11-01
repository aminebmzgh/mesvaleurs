import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { type ReceiptPdfData, receiptPdf } from "./pdf";

// PNG 1×1 transparent : signature minimale
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

const data: ReceiptPdfData = {
  organization: { name: "Atlas Distribution SARL", address: "45, bd Zerktouni", city: "Casablanca", phone: null, email: null, ice: "002345678000041", taxId: null, tradeRegister: null, logo: null },
  supplier: { name: "Atlas Transport & Logistique", address: null, city: "Casablanca", ice: "002468135000076" },
  reference: "AR-2026-0001",
  signedAt: "2026-10-20T09:15:00.000Z",
  deliveredOn: "2026-10-20",
  signerName: "Karim Alami",
  signerIdNumber: "BE123456",
  signature: PNG,
  payments: [{ label: "Chèque 0001003", bank: "Attijariwafa bank", dueDate: null, amount: 8450.5 }],
  total: 8450.5,
};

describe("receiptPdf", () => {
  it("une page, titre et signature intégrés", async () => {
    const pdf = await PDFDocument.load(await receiptPdf(data));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Accusé de réception AR-2026-0001");
  });

  it("signature illisible ou absente : le reçu est quand même généré", async () => {
    expect((await PDFDocument.load(await receiptPdf({ ...data, signature: new Uint8Array([1, 2, 3]), signerIdNumber: null }))).getPageCount()).toBe(1);
    expect((await PDFDocument.load(await receiptPdf({ ...data, signature: null }))).getPageCount()).toBe(1);
  });
});
