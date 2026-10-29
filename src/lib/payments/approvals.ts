/** Double signature et plafonds (spec §6.2 et §11 bis I) : motifs et droits de validation. */

import { parseAmount } from "@/lib/amount";
import { formatMAD } from "@/lib/format";
import type { AppRole } from "@/types/app";
import type { Database, Json } from "@/types/database";

export type BatchApprovalStatus = Database["public"]["Enums"]["batch_approval_status"];

export type ApprovalReason = {
  kind: "threshold" | "user_daily" | "supplier_daily" | "org_daily";
  limit: number;
  total: number;
};

const KINDS = ["threshold", "user_daily", "supplier_daily", "org_daily"] as const;

/** Motifs enregistrés par issue_payments ; une entrée illisible est ignorée. */
export function parseApprovalReasons(value: Json | null | undefined): ApprovalReason[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }
    const { kind, limit, total } = item as Record<string, unknown>;
    return KINDS.includes(kind as ApprovalReason["kind"]) && typeof limit === "number" && typeof total === "number"
      ? [{ kind: kind as ApprovalReason["kind"], limit, total }]
      : [];
  });
}

/** Phrase lisible d'un motif de validation. */
export function approvalReasonLabel(reason: ApprovalReason): string {
  switch (reason.kind) {
    case "threshold":
      return `Formule de ${formatMAD(reason.total)}, au-delà du seuil de validation (${formatMAD(reason.limit)})`;
    case "user_daily":
      return `Plafond journalier du préparateur dépassé : ${formatMAD(reason.total)} pour ${formatMAD(reason.limit)}`;
    case "supplier_daily":
      return `Plafond journalier du fournisseur dépassé : ${formatMAD(reason.total)} pour ${formatMAD(reason.limit)}`;
    case "org_daily":
      return `Plafond journalier de l'entreprise dépassé : ${formatMAD(reason.total)} pour ${formatMAD(reason.limit)}`;
  }
}

/** Rôles qui valident ou refusent un lot. */
export const APPROVER_ROLES: AppRole[] = ["admin", "manager"];

/** Peut valider ce lot : gestionnaire ou administrateur, autre que le préparateur. */
export function canDecideBatch(role: AppRole, userId: string, preparedBy: string | null): boolean {
  return APPROVER_ROLES.includes(role) && preparedBy !== userId;
}

/** Plafond saisi : vide → null (aucun plafond) ; montant positif ; sinon undefined (invalide). */
export function parseCeiling(input: string): number | null | undefined {
  const text = input.trim();
  if (text === "") {
    return null;
  }
  const amount = parseAmount(text);
  return amount !== null && amount > 0 ? amount : undefined;
}
