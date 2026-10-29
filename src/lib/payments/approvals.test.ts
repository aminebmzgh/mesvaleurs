import { describe, expect, it } from "vitest";
import { formatMAD } from "@/lib/format";
import { approvalReasonLabel, canDecideBatch, parseApprovalReasons, parseCeiling } from "./approvals";

describe("parseApprovalReasons", () => {
  it("lit les motifs enregistrés et ignore les entrées illisibles", () => {
    expect(
      parseApprovalReasons([
        { kind: "threshold", limit: 50000, total: 62000 },
        { kind: "inconnu", limit: 1, total: 2 },
        { kind: "org_daily", limit: "x", total: 2 },
        null,
      ]),
    ).toEqual([{ kind: "threshold", limit: 50000, total: 62000 }]);
    expect(parseApprovalReasons(null)).toEqual([]);
    expect(parseApprovalReasons({ kind: "threshold" })).toEqual([]);
  });
});

describe("approvalReasonLabel", () => {
  it("rédige chaque motif avec les montants", () => {
    expect(approvalReasonLabel({ kind: "threshold", limit: 50000, total: 62000 })).toBe(
      `Formule de ${formatMAD(62000)}, au-delà du seuil de validation (${formatMAD(50000)})`,
    );
    expect(approvalReasonLabel({ kind: "supplier_daily", limit: 100000, total: 120000 })).toBe(
      `Plafond journalier du fournisseur dépassé : ${formatMAD(120000)} pour ${formatMAD(100000)}`,
    );
  });
});

describe("canDecideBatch", () => {
  it("gestionnaire ou administrateur, autre que le préparateur", () => {
    expect(canDecideBatch("manager", "u2", "u1")).toBe(true);
    expect(canDecideBatch("admin", "u1", "u1")).toBe(false);
    expect(canDecideBatch("preparer", "u2", "u1")).toBe(false);
    expect(canDecideBatch("accountant", "u2", "u1")).toBe(false);
  });
});

describe("parseCeiling", () => {
  it("vide : aucun plafond ; montant positif ; sinon invalide", () => {
    expect(parseCeiling("  ")).toBeNull();
    expect(parseCeiling("50 000,00")).toBe(50000);
    expect(parseCeiling("0")).toBeUndefined();
    expect(parseCeiling("beaucoup")).toBeUndefined();
  });
});
