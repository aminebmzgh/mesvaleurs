import { toCents } from "@/lib/amount";

/**
 * Rapprochement automatique des lignes de relevé avec les chèques et LCN en
 * circulation (spec §7.2). Calcul en mémoire : un relevé de plusieurs centaines de
 * lignes est traité en quelques millisecondes.
 */

export type LineToMatch = {
  id: string;
  debit: number | null;
  credit: number | null;
  extractedNumber: number | null;
  kind: "check" | "lcn" | null;
};

export type CandidatePayment = {
  id: string;
  number: number;
  amount: number;
  type: "check" | "lcn" | "guarantee_check";
};

export type MatchStatus = "auto_matched" | "to_confirm" | "unmatched";

export type MatchResult = {
  lineId: string;
  paymentId: string | null;
  status: MatchStatus;
  /** Score de confiance, de 0 à 100. */
  confidence: number | null;
  reason: string;
};

/** Écart de numéro considéré comme une faute de frappe probable. */
const CLOSE_NUMBER_GAP = 2;

const kindOf = (payment: CandidatePayment) => (payment.type === "lcn" ? "lcn" : "check");

export function matchLines(lines: LineToMatch[], payments: CandidatePayment[]): MatchResult[] {
  const used = new Set<string>();
  const results = new Map<string, MatchResult>();
  const available = (payment: CandidatePayment) => !used.has(payment.id);
  const assign = (line: LineToMatch, payment: CandidatePayment, status: MatchStatus, confidence: number, reason: string) => {
    used.add(payment.id);
    results.set(line.id, { lineId: line.id, paymentId: payment.id, status, confidence, reason });
  };
  const compatible = (line: LineToMatch, payment: CandidatePayment) => line.kind === null || kindOf(payment) === line.kind;

  // Seuls les débits correspondent à des chèques ou LCN payés
  const debits = lines.filter((line) => line.debit !== null && line.debit > 0);

  // 1. Numéro et montant identiques : rapprochement automatique
  for (const line of debits) {
    if (line.extractedNumber === null) {
      continue;
    }
    const payment = payments.find(
      (p) =>
        available(p) &&
        p.number === line.extractedNumber &&
        compatible(line, p) &&
        toCents(p.amount) === toCents(line.debit!),
    );
    if (payment) {
      assign(line, payment, "auto_matched", 100, "Numéro et montant identiques");
    }
  }

  // 2. Numéro identique, montant différent : à confirmer
  for (const line of debits) {
    if (results.has(line.id) || line.extractedNumber === null) {
      continue;
    }
    const payment = payments.find((p) => available(p) && p.number === line.extractedNumber && compatible(line, p));
    if (payment) {
      const gap = Math.abs(toCents(payment.amount) - toCents(line.debit!));
      const close = gap <= toCents(payment.amount) * 0.01;
      assign(line, payment, "to_confirm", close ? 75 : 60, "Numéro identique, montant différent");
    }
  }

  // 3. Montant identique : numéro proche (faute de frappe) ou absent, candidat unique
  for (const line of debits) {
    if (results.has(line.id)) {
      continue;
    }
    const sameAmount = payments.filter(
      (p) => available(p) && compatible(line, p) && toCents(p.amount) === toCents(line.debit!),
    );
    if (line.extractedNumber !== null) {
      const close = sameAmount
        .filter((p) => Math.abs(p.number - line.extractedNumber!) <= CLOSE_NUMBER_GAP)
        .sort((a, b) => Math.abs(a.number - line.extractedNumber!) - Math.abs(b.number - line.extractedNumber!));
      if (close.length > 0) {
        assign(line, close[0], "to_confirm", 70, "Montant identique, numéro proche");
        continue;
      }
    } else if (sameAmount.length === 1) {
      assign(line, sameAmount[0], "to_confirm", 50, "Montant identique, numéro absent du libellé");
      continue;
    }
  }

  return lines.map(
    (line) =>
      results.get(line.id) ?? {
        lineId: line.id,
        paymentId: null,
        status: "unmatched",
        confidence: null,
        reason:
          line.credit !== null && line.credit > 0
            ? "Crédit (hors chèques et LCN émis)"
            : line.extractedNumber !== null
              ? "Numéro inconnu parmi les paiements en circulation"
              : "Aucun paiement correspondant",
      },
  );
}
