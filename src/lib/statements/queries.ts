import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { paymentLabel } from "@/lib/payments/label";
import { isRejectionLabel } from "@/lib/statements/extract";
import { createClient } from "@/lib/supabase/server";

export type LineStatus = "auto_matched" | "manually_matched" | "to_confirm" | "unmatched" | "ignored";

/** Relevés importés, du plus récent au plus ancien, avec la répartition de leurs lignes. */
export async function listImports() {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data: imports, error } = await supabase
    .from("statement_imports")
    .select("id, period_start, period_end, format, status, line_count, created_at, bank_accounts ( label, banks ( name ) )")
    .eq("organization_id", organization.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new Error("Impossible de charger les relevés.", { cause: error });
  }
  const ids = imports.map((i) => i.id);
  const { data: lines } = ids.length
    ? await supabase.from("statement_lines").select("import_id, status, debit").in("import_id", ids)
    : { data: [] };

  return imports.map((statementImport) => {
    const own = (lines ?? []).filter((line) => line.import_id === statementImport.id);
    return {
      ...statementImport,
      matched: own.filter((l) => l.status === "auto_matched" || l.status === "manually_matched").length,
      toConfirm: own.filter((l) => l.status === "to_confirm").length,
      // Débits encore à traiter (chèques débités inconnus, frais non classés…)
      unmatchedDebits: own.filter((l) => l.status === "unmatched" && (l.debit ?? 0) > 0).length,
    };
  });
}

/** Détail d'un import : lignes avec leur proposition, paiements en circulation du compte. */
export async function getImport(importId: string) {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const orgId = organization.organizationId;

  const { data: statementImport, error } = await supabase
    .from("statement_imports")
    .select("id, bank_account_id, period_start, period_end, status, line_count, created_at, bank_accounts ( label, banks ( name ) )")
    .eq("organization_id", orgId)
    .eq("id", importId)
    .maybeSingle();
  if (error) {
    throw new Error("Impossible de charger le relevé.", { cause: error });
  }
  if (!statementImport) {
    return null;
  }

  const [lines, payments] = await Promise.all([
    supabase
      .from("statement_lines")
      .select(
        `id, operation_date, value_date, label, reference, debit, credit, extracted_number, extracted_kind, status, confidence,
         match_reason, matched_payment_id,
         payments!statement_lines_organization_id_matched_payment_id_fkey ( id, type, number, reference, amount, suppliers ( name ), checkbooks ( number_width ) )`,
      )
      .eq("organization_id", orgId)
      .eq("import_id", importId)
      .order("operation_date")
      .order("created_at"),
    supabase
      .from("payments")
      .select("id, type, number, reference, amount, issue_date, due_date, status, suppliers ( name ), checkbooks ( number_width )")
      .eq("organization_id", orgId)
      .eq("bank_account_id", statementImport.bank_account_id)
      .in("status", ["issued", "delivered"])
      .order("number"),
  ]);
  if (lines.error || payments.error) {
    throw new Error("Impossible de charger le relevé.", { cause: lines.error ?? payments.error });
  }
  // Lignes signalant un rejet : paiement concerné (même compte, même numéro, non encore rejeté)
  const signalled = (lines.data ?? []).filter((line) => line.extracted_number !== null && isRejectionLabel(line.label));
  const rejections: Record<string, { id: string; label: string; type: string }> = {};
  if (signalled.length > 0) {
    const { data: rejectable } = await supabase
      .from("payments")
      .select("id, type, number, reference, checkbooks ( number_width )")
      .eq("organization_id", orgId)
      .eq("bank_account_id", statementImport.bank_account_id)
      .in("type", ["check", "lcn"])
      .in("status", ["issued", "delivered", "paid"])
      .in("number", signalled.map((line) => line.extracted_number!));
    for (const line of signalled) {
      const payment = (rejectable ?? []).find((p) => p.number === line.extracted_number);
      if (payment) {
        rejections[line.id] = { id: payment.id, label: paymentLabel(payment), type: payment.type };
      }
    }
  }
  return { ...statementImport, lines: lines.data ?? [], payments: payments.data ?? [], rejections };
}

export type ImportDetail = NonNullable<Awaited<ReturnType<typeof getImport>>>;
