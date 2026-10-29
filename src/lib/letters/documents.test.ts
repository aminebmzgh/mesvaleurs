import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  type OppositionData,
  oppositionDocument,
  oppositionValues,
  postponementRequestDocument,
  type PostponementRequestData,
  reminderDocument,
  statementRequestDocument,
  type StatementRequestData,
} from "./documents";
import { formatMAD } from "@/lib/format";
import { letterPdf } from "./pdf";
import { BUILTIN_TEMPLATES } from "./templates";

const letterhead = {
  organization: { name: "Atlas Distribution SARL", address: "45, bd Zerktouni", city: "Casablanca", phone: null, email: null, ice: null, taxId: null, tradeRegister: null, logo: null },
  signer: { name: "Salma El Idrissi", jobTitle: "Responsable administratif et financier" },
  place: "Casablanca",
  date: "2026-10-28",
};

const opposition: OppositionData = {
  ...letterhead,
  reference: "OP-20261028-1003",
  bank: { name: "Attijariwafa bank", branch: "Casablanca Anfa", accountLabel: "Compte courant", rib: "007780000123456789012345" },
  reason: "lost",
  occurredOn: "2026-10-27",
  policeReport: null,
  instrument: "check",
  numberWidth: 7,
  payment: { type: "check", number: 1003, payee: "ATLAS TRANSPORT", amount: 8450.5, issueDate: "2026-10-14" },
  firstNumber: 1003,
  lastNumber: 1003,
};

const pages = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe("oppositionDocument", () => {
  it("désigne le chèque émis et le motif", () => {
    const values = oppositionValues(opposition);
    expect(values.valeurs).toBe(`le chèque n° 0001003 d'un montant de ${formatMAD(8450.5)} à l'ordre de ATLAS TRANSPORT`);
    expect(values.motif).toBe("perte");
    expect(values.recepisse).toBe("références à compléter");
    const doc = oppositionDocument(opposition, BUILTIN_TEMPLATES.opposition[0]);
    expect(doc.recipient.name).toBe("Attijariwafa bank");
    expect(doc.body).toContain("RIB 007780000123456789012345");
    expect(doc.body).toContain("constaté(e) le 27/10/2026");
    expect(doc.table?.rows).toEqual([["Chèque n° 0001003", "ATLAS TRANSPORT", "14/10/2026", formatMAD(8450.5)]]);
  });

  it("formules vierges : plage et nombre de formules", () => {
    const blank = { ...opposition, reason: "stolen" as const, payment: null, firstNumber: 1006, lastNumber: 1010 };
    expect(oppositionValues(blank).valeurs).toBe("les formules de chèque vierges n° 0001006 à 0001010 (5 formules)");
    expect(oppositionValues({ ...blank, lastNumber: 1006, instrument: "lcn" }).valeurs).toBe("la formule de LCN vierge n° 0001006");
    expect(oppositionDocument(blank, BUILTIN_TEMPLATES.opposition[0]).table?.rows[0][0]).toBe("Formules n° 0001006 à 0001010");
  });

  it("PDF d'une page", async () => {
    expect(await pages(await letterPdf(oppositionDocument(opposition, BUILTIN_TEMPLATES.opposition[0])))).toBe(1);
  });
});

describe("postponementRequestDocument", () => {
  const data: PostponementRequestData = {
    ...letterhead,
    reference: "PR-20261028-5000101",
    supplier: { name: "Maghreb Emballages SA", lines: ["Tanger"] },
    lcn: { number: 5000101, numberWidth: 7, amount: 40000, bank: "Banque Populaire", dueDate: "2026-11-18" },
    newDueDate: "2026-12-18",
    reason: "",
  };

  it("échéances actuelle et demandée, zone d'accord du fournisseur", async () => {
    const doc = postponementRequestDocument(data, BUILTIN_TEMPLATES.postponement_request[0]);
    expect(doc.subject).toBe("Demande de prorogation d'échéance — LCN n° 5000101");
    expect(doc.body).toContain("initialement fixée au 18/11/2026, au 18/12/2026");
    expect(doc.body).toContain("Motif : décalage de trésorerie.");
    expect(doc.counterpart).toMatch(/Bon pour accord/);
    expect(await pages(await letterPdf(doc))).toBe(1);
  });
});

describe("statementRequestDocument", () => {
  const data: StatementRequestData = {
    ...letterhead,
    reference: "RC-20261028",
    supplier: { name: "Sotrama Matériaux SARL", lines: [] },
    asOf: "2026-10-31",
    invoices: [
      { number: "F-1", issueDate: "2026-09-01", amountInclTax: 1000.1, remaining: 1000.1 },
      { number: "F-2", issueDate: "2026-09-15", amountInclTax: 500, remaining: 200.2 },
    ],
  };

  it("solde selon nos livres et tableau des factures non soldées", () => {
    const doc = statementRequestDocument(data, BUILTIN_TEMPLATES.statement_request[0]);
    expect(doc.subject).toBe("Demande de relevé de compte au 31/10/2026");
    expect(doc.body).toContain(`s'élève à ${formatMAD(1200.3)}`);
    expect(doc.table?.footer).toEqual(["Solde", "", "", formatMAD(1200.3)]);
    expect(statementRequestDocument({ ...data, invoices: [] }, BUILTIN_TEMPLATES.statement_request[0]).table).toBeUndefined();
  });
});

describe("reminderDocument", () => {
  it("relance sans tableau", async () => {
    const doc = reminderDocument(
      {
        ...letterhead,
        reference: "RL-20261028",
        customer: { name: "Comptoir du Nord", lines: ["Rabat"] },
        invoices: "la facture n° V-114",
        amountDue: 12000,
        deadline: "2026-11-05",
      },
      BUILTIN_TEMPLATES.reminder[0],
    );
    expect(doc.body).toContain(`règlement de la facture n° V-114, d'un montant restant dû de ${formatMAD(12000)}`);
    expect(doc.body).toContain("au plus tard le 05/11/2026");
    expect(doc.table).toBeUndefined();
    expect(await pages(await letterPdf(doc))).toBe(1);
  });
});
