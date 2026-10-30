import { describe, expect, it } from "vitest";
import { accountingExportSchema } from "@/lib/organizations/settings";
import { journalCsv, journalEntries, type JournalPayment, journalTotals } from "./journal";

const defaults = accountingExportSchema.parse({});

const payment = (overrides: Partial<JournalPayment>): JournalPayment => ({
  type: "check",
  piece: "0001003",
  label: "Chèque 0001003",
  amount: 8450.5,
  issueDate: "2026-10-14",
  debitedAt: "2026-10-20",
  supplier: { name: "Atlas Transport", accountingCode: "FATLAS" },
  bankAccountCode: null,
  invoices: ["ATL-7781"],
  ...overrides,
});

describe("journalEntries — base « débit »", () => {
  it("fournisseur au débit, banque au crédit, à la date de débit", () => {
    const lines = journalEntries([payment({})], "2026-10", defaults);
    expect(lines).toEqual([
      {
        date: "2026-10-20",
        journal: "BQ",
        account: "44110000",
        auxiliary: "FATLAS",
        piece: "0001003",
        label: "Règlement Atlas Transport — Chèque 0001003 — ATL-7781",
        debit: 8450.5,
        credit: 0,
      },
      {
        date: "2026-10-20",
        journal: "BQ",
        account: "51410000",
        auxiliary: "",
        piece: "0001003",
        label: "Règlement Atlas Transport — Chèque 0001003 — ATL-7781",
        debit: 0,
        credit: 8450.5,
      },
    ]);
  });

  it("code du compte bancaire prioritaire ; paiement débité un autre mois exclu", () => {
    const lines = journalEntries([payment({ bankAccountCode: "51410002" }), payment({ debitedAt: "2026-11-02" })], "2026-10", defaults);
    expect(lines).toHaveLength(2);
    expect(lines[1].account).toBe("51410002");
  });
});

describe("journalEntries — base « émission »", () => {
  const issue = { ...defaults, basis: "issue" as const };

  it("chèque à l'émission ; LCN par les effets à payer, puis effets / banque au débit", () => {
    const lines = journalEntries(
      [
        payment({ debitedAt: null }),
        payment({ type: "lcn", piece: "5000101", label: "LCN 5000101", amount: 40000, issueDate: "2026-07-21", debitedAt: "2026-10-18" }),
        payment({ type: "lcn", piece: "5000120", label: "LCN 5000120", amount: 1000, issueDate: "2026-10-02", debitedAt: null }),
      ],
      "2026-10",
      issue,
    );
    expect(lines.map((l) => [l.date, l.piece, l.account, l.debit, l.credit])).toEqual([
      ["2026-10-02", "5000120", "44110000", 1000, 0],
      ["2026-10-02", "5000120", "44150000", 0, 1000],
      ["2026-10-14", "0001003", "44110000", 8450.5, 0],
      ["2026-10-14", "0001003", "51410000", 0, 8450.5],
      ["2026-10-18", "5000101", "44150000", 40000, 0],
      ["2026-10-18", "5000101", "51410000", 0, 40000],
    ]);
    expect(lines.find((l) => l.piece === "5000101")!.label).toMatch(/^Échéance LCN /);
  });

  it("chèque de garantie : seulement s'il est encaissé", () => {
    const guarantee = payment({ type: "guarantee_check", issueDate: "2026-10-01", debitedAt: null });
    expect(journalEntries([guarantee], "2026-10", issue)).toEqual([]);
    expect(journalEntries([{ ...guarantee, debitedAt: "2026-10-30" }], "2026-10", issue)).toHaveLength(2);
  });
});

describe("journalCsv / journalTotals", () => {
  const lines = journalEntries([payment({ supplier: { name: 'Atlas; "Transport"', accountingCode: null } })], "2026-10", defaults);

  it("format par défaut : BOM, « ; », jj/mm/aaaa, virgule décimale, en-tête", () => {
    const rows = journalCsv(lines, defaults).slice(1).split("\r\n");
    expect(rows[0]).toBe("Date;Journal;Compte;Compte auxiliaire;Pièce;Libellé;Débit;Crédit");
    expect(rows[1]).toBe('20/10/2026;BQ;44110000;;0001003;"Règlement Atlas; ""Transport"" — Chèque 0001003 — ATL-7781";8450,50;');
    expect(rows[2].endsWith(";;8450,50")).toBe(true);
  });

  it("format paramétré : tabulation, aaaa-mm-jj, point décimal, sans en-tête", () => {
    const rows = journalCsv(lines, { ...defaults, separator: "tab", dateFormat: "yyyy-mm-dd", decimal: ".", header: false }).slice(1).split("\r\n");
    expect(rows[0].split("\t")).toEqual(["2026-10-20", "BQ", "44110000", "", "0001003", '"Règlement Atlas; ""Transport"" — Chèque 0001003 — ATL-7781"', "8450.50", ""]);
    expect(journalCsv(lines, { ...defaults, dateFormat: "ddmmyy" }).split("\r\n")[1].startsWith("201026;")).toBe(true);
  });

  it("journal équilibré", () => {
    expect(journalTotals(lines)).toEqual({ debit: 8450.5, credit: 8450.5 });
  });
});
