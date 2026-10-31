import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkUbl, parseUbl, paymentTermsDays, UblError } from "./ubl";

const template = fs.readFileSync(path.join(__dirname, "../../../e2e/fixtures/facture-ubl.xml"), "utf8");
const sample = (values: Partial<Record<"NUMBER" | "ICE" | "NAME", string>> = {}) =>
  template
    .replaceAll("{{NUMBER}}", values.NUMBER ?? "FV-2026-0458")
    .replaceAll("{{ICE}}", values.ICE ?? "001122334000055")
    .replaceAll("{{NAME}}", values.NAME ?? "Emballages du Nord SARL");

describe("parseUbl", () => {
  const invoice = parseUbl(sample());

  it("facture, fournisseur et totaux", () => {
    expect(invoice).toMatchObject({
      number: "FV-2026-0458",
      issueDate: "2026-10-15",
      dueDate: "2026-12-14",
      currency: "MAD",
      customerIce: "002345678000041",
      amountExclTax: 12000,
      vatAmount: 2400,
      amountInclTax: 14400,
      linesTotal: 12000,
    });
    expect(invoice.supplier).toEqual({
      name: "Emballages du Nord SARL",
      ice: "001122334000055",
      taxId: "45879632",
      tradeRegister: "RC Tanger 55120",
      address: "12, zone industrielle Gzenaya",
      city: "Tanger",
      rib: "150500211501441691001583",
    });
    expect(paymentTermsDays(invoice)).toBe(60);
  });

  it("refuse avoirs, autres formats, entités et fichiers incomplets", () => {
    expect(() => parseUbl('<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"/>')).toThrow(/Avoir/);
    expect(() => parseUbl("<Order/>")).toThrow(UblError);
    expect(() => parseUbl('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><Invoice>&e;</Invoice>')).toThrow(/DOCTYPE/);
    expect(() => parseUbl(sample().replace(/<cbc:IssueDate>.*<\/cbc:IssueDate>/, ""))).toThrow(/date/);
    expect(() => parseUbl("pas du xml <")).toThrow(UblError);
  });
});

describe("checkUbl", () => {
  it("fichier cohérent : aucun contrôle bloquant", () => {
    expect(checkUbl(parseUbl(sample()), { organizationIce: "002345678000041", duplicate: false })).toEqual([]);
  });

  it("totaux, devise, doublon et destinataire", () => {
    const invoice = { ...parseUbl(sample()), currency: "EUR", vatAmount: 2000, linesTotal: 11000 };
    const checks = checkUbl(invoice, { organizationIce: "009999999000099", duplicate: true });
    expect(checks.filter((check) => check.level === "error").map((check) => check.message)).toEqual([
      "Devise EUR : seules les factures en dirhams (MAD) sont acceptées.",
      "Facture FV-2026-0458 déjà enregistrée pour ce fournisseur.",
      "Totaux incohérents : HT + TVA différent du TTC.",
    ]);
    expect(checks.filter((check) => check.level === "warning")).toHaveLength(2);
  });
});
