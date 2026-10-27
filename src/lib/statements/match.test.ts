import { describe, expect, it } from "vitest";
import { type CandidatePayment, type LineToMatch, matchLines } from "./match";

const line = (id: string, debit: number | null, number: number | null, kind: LineToMatch["kind"] = number ? "check" : null): LineToMatch => ({
  id,
  debit,
  credit: debit === null ? 1000 : null,
  extractedNumber: number,
  kind,
});
const payment = (id: string, number: number, amount: number, type: CandidatePayment["type"] = "check"): CandidatePayment => ({
  id,
  number,
  amount,
  type,
});

// Situation du relevé de démonstration (Attijariwafa, octobre 2026)
const PAYMENTS = [
  payment("p1000", 1000, 24000),
  payment("p1001", 1001, 24000),
  payment("p1002", 1002, 15600),
  payment("p1003", 1003, 8450.5),
];

describe("matchLines", () => {
  it("rapproche automatiquement numéro + montant identiques", () => {
    const [result] = matchLines([line("l1", 24000, 1000)], PAYMENTS);
    expect(result).toEqual({ lineId: "l1", paymentId: "p1000", status: "auto_matched", confidence: 100, reason: "Numéro et montant identiques" });
  });

  it("numéro identique, montant différent : à confirmer", () => {
    const [result] = matchLines([line("l4", 15060, 1002)], PAYMENTS);
    expect(result).toMatchObject({ paymentId: "p1002", status: "to_confirm", confidence: 60 });
  });

  it("écart de moins de 1 % : confiance plus élevée", () => {
    const [result] = matchLines([line("l", 15599, 1002)], PAYMENTS);
    expect(result).toMatchObject({ status: "to_confirm", confidence: 75 });
  });

  it("montant identique et numéro proche (faute de frappe) : à confirmer", () => {
    const [result] = matchLines([line("l", 8450.5, 1008)], [payment("p1009", 1009, 8450.5), payment("p2000", 2000, 8450.5)]);
    expect(result).toMatchObject({ paymentId: "p1009", status: "to_confirm", confidence: 70, reason: "Montant identique, numéro proche" });
  });

  it("montant identique sans numéro : à confirmer seulement si le candidat est unique", () => {
    expect(matchLines([line("l", 8450.5, null)], PAYMENTS)[0]).toMatchObject({ paymentId: "p1003", status: "to_confirm", confidence: 50 });
    // Deux chèques de 24 000 : ambigu, rien n'est proposé
    expect(matchLines([line("l", 24000, null)], PAYMENTS)[0]).toMatchObject({ paymentId: null, status: "unmatched" });
  });

  it("numéro inconnu et frais bancaires : non rapprochés", () => {
    const results = matchLines([line("l5", 3200, 1017), line("l3", 45, null)], PAYMENTS);
    expect(results.map((r) => [r.status, r.reason])).toEqual([
      ["unmatched", "Numéro inconnu parmi les paiements en circulation"],
      ["unmatched", "Aucun paiement correspondant"],
    ]);
  });

  it("les crédits ne sont jamais rapprochés à un paiement émis", () => {
    expect(matchLines([line("l6", null, null)], PAYMENTS)[0]).toMatchObject({ status: "unmatched", reason: "Crédit (hors chèques et LCN émis)" });
  });

  it("un paiement n'est rapproché qu'une fois, l'exact passe en premier", () => {
    // La ligne approximative arrive avant l'exacte dans le relevé
    const results = matchLines([line("approx", 24000, null), line("exact", 24000, 1001)], [payment("p1001", 1001, 24000)]);
    expect(results.find((r) => r.lineId === "exact")).toMatchObject({ paymentId: "p1001", status: "auto_matched" });
    expect(results.find((r) => r.lineId === "approx")).toMatchObject({ paymentId: null, status: "unmatched" });
  });

  it("ne rapproche pas une LCN avec un chèque du même numéro", () => {
    const results = matchLines([line("l", 1000, 5000101, "lcn")], [payment("chq", 5000101, 1000, "check"), payment("lcn", 5000101, 1000, "lcn")]);
    expect(results[0]).toMatchObject({ paymentId: "lcn", status: "auto_matched" });
  });

  it("relevé de démonstration complet", () => {
    const lines = [
      line("l1", 24000, 1000),
      line("l2", 24000, 1001),
      line("l3", 45, null),
      line("l4", 15060, 1002),
      line("l5", 3200, 1017),
      line("l6", null, null),
    ];
    expect(matchLines(lines, PAYMENTS).map((r) => [r.lineId, r.status, r.paymentId])).toEqual([
      ["l1", "auto_matched", "p1000"],
      ["l2", "auto_matched", "p1001"],
      ["l3", "unmatched", null],
      ["l4", "to_confirm", "p1002"],
      ["l5", "unmatched", null],
      ["l6", "unmatched", null],
    ]);
  });

  it("500 lignes rapprochées en moins de 100 ms", () => {
    const payments = Array.from({ length: 500 }, (_, i) => payment(`p${i}`, 100000 + i, 1000 + i));
    const lines = Array.from({ length: 500 }, (_, i) => line(`l${i}`, 1000 + i, 100000 + i));
    const start = performance.now();
    const results = matchLines(lines, payments);
    expect(performance.now() - start).toBeLessThan(100);
    expect(results.every((r) => r.status === "auto_matched")).toBe(true);
  });
});
