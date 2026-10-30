"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { extractInstrumentNumber, isRejectionLabel } from "@/lib/statements/extract";
import { matchLines } from "@/lib/statements/match";
import { lineKeys, statementPeriod } from "@/lib/statements/parse";
import { type ImportRequest, importRequestSchema, isStatementPathOf } from "@/lib/statements/schemas";
import { createClient } from "@/lib/supabase/server";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };
export type ActionResult = { error?: string };

export type ImportSummary = {
  importId: string;
  inserted: number;
  duplicates: number;
  autoMatched: number;
  toConfirm: number;
};

const readable = (error: { code?: string; message?: string } | null, fallback: string) =>
  error && ["P0001", "P0002"].includes(error.code ?? "") ? error.message! : fallback;

/**
 * Import d'un relevé : les lignes ont été lues dans le navigateur ; le serveur les
 * valide, écarte les doublons, enregistre l'import puis lance le rapprochement.
 */
export async function importStatement(request: ImportRequest): Promise<Result<ImportSummary>> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const parsed = importRequestSchema.safeParse(request);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Relevé invalide." };
  }
  const input = parsed.data;
  const orgId = organization.organizationId;
  if (input.filePath && !isStatementPathOf(input.filePath, orgId, input.bankAccountId)) {
    return { ok: false, error: "Fichier invalide." };
  }
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("bank_accounts")
    .select("id, bank_id")
    .eq("organization_id", orgId)
    .eq("id", input.bankAccountId)
    .maybeSingle();
  if (!account) {
    return { ok: false, error: "Compte bancaire introuvable." };
  }

  const period = statementPeriod(input.lines);
  const { data: statementImport, error: importError } = await supabase
    .from("statement_imports")
    .insert({
      organization_id: orgId,
      bank_account_id: account.id,
      format: input.format,
      status: "processing",
      file_path: input.filePath,
      file_hash: input.fileHash,
      period_start: period?.start ?? null,
      period_end: period?.end ?? null,
      imported_by: (await supabase.auth.getClaims()).data?.claims.sub ?? null,
    })
    .select("id")
    .single();
  if (importError) {
    return {
      ok: false,
      error: importError.code === "23505" ? "Ce relevé a déjà été importé pour ce compte." : "Impossible d'enregistrer l'import.",
    };
  }

  // Lignes : numéro extrait du libellé, empreinte pour écarter les doublons d'un import à l'autre
  const keys = lineKeys(input.lines);
  const rows = input.lines.map((line, index) => {
    const extracted = extractInstrumentNumber(line.label);
    return {
      organization_id: orgId,
      import_id: statementImport.id,
      bank_account_id: account.id,
      operation_date: line.operationDate,
      value_date: line.valueDate,
      label: line.label,
      reference: line.reference,
      debit: line.debit,
      credit: line.credit,
      extracted_number: extracted?.number ?? null,
      extracted_kind: extracted?.kind ?? null,
      line_hash: createHash("sha256").update(keys[index]).digest("hex"),
    };
  });
  const { data: inserted, error: linesError } = await supabase
    .from("statement_lines")
    .upsert(rows, { onConflict: "bank_account_id,line_hash", ignoreDuplicates: true })
    .select("id, label, debit, credit, extracted_number, extracted_kind");
  if (linesError) {
    await supabase.from("statement_imports").delete().eq("id", statementImport.id);
    return { ok: false, error: "Impossible d'enregistrer les lignes du relevé." };
  }
  const insertedLines = inserted ?? [];
  if (insertedLines.length === 0) {
    await supabase.from("statement_imports").delete().eq("id", statementImport.id);
    return { ok: false, error: "Toutes les lignes de ce relevé ont déjà été importées." };
  }

  // Rapprochement automatique avec les chèques et LCN en circulation sur ce compte
  const { data: payments } = await supabase
    .from("payments")
    .select("id, number, amount, type")
    .eq("organization_id", orgId)
    .eq("bank_account_id", account.id)
    .in("status", ["issued", "delivered"])
    .not("number", "is", null);
  const matches = matchLines(
    insertedLines.map((line) => ({
      id: line.id,
      debit: line.debit,
      credit: line.credit,
      // Ligne d'impayé ou de rejet : jamais rapprochée comme un débit du chèque
      extractedNumber: isRejectionLabel(line.label) ? null : line.extracted_number,
      kind: (line.extracted_kind as "check" | "lcn" | null) ?? null,
    })),
    (payments ?? []).map((payment) => ({ id: payment.id, number: payment.number!, amount: payment.amount, type: payment.type })),
  );
  const { error: matchError } = await supabase.rpc("apply_statement_matches", {
    p_import_id: statementImport.id,
    p_matches: matches.map((match) => ({
      line_id: match.lineId,
      payment_id: match.paymentId,
      status: match.status,
      confidence: match.confidence,
      reason: match.reason,
    })),
  });
  await supabase.from("statement_imports").update({ line_count: insertedLines.length }).eq("id", statementImport.id);
  if (matchError) {
    return { ok: false, error: readable(matchError, "Les lignes sont importées, mais le rapprochement a échoué.") };
  }

  // Correspondance des colonnes mémorisée pour les prochains relevés de cette banque
  await supabase.from("statement_column_mappings").upsert(
    { organization_id: orgId, bank_id: account.bank_id, header_signature: input.headerSignature, mapping: input.mapping },
    { onConflict: "organization_id,bank_id" },
  );

  revalidatePath("/", "layout");
  return {
    ok: true,
    data: {
      importId: statementImport.id,
      inserted: insertedLines.length,
      duplicates: input.lines.length - insertedLines.length,
      autoMatched: matches.filter((m) => m.status === "auto_matched").length,
      toConfirm: matches.filter((m) => m.status === "to_confirm").length,
    },
  };
}

/** Correspondance mémorisée pour la banque d'un compte (null si aucune). */
export async function loadColumnMapping(bankAccountId: string) {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const supabase = await createClient();
  const { data: account } = await supabase
    .from("bank_accounts")
    .select("bank_id")
    .eq("organization_id", organization.organizationId)
    .eq("id", z.uuid().parse(bankAccountId))
    .maybeSingle();
  if (!account) {
    return null;
  }
  const { data } = await supabase
    .from("statement_column_mappings")
    .select("header_signature, mapping")
    .eq("organization_id", organization.organizationId)
    .eq("bank_id", account.bank_id)
    .maybeSingle();
  return data;
}

export async function confirmLine(lineId: string, paymentId: string): Promise<ActionResult> {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_statement_line", {
    p_line_id: z.uuid().parse(lineId),
    p_payment_id: z.uuid().parse(paymentId),
  });
  revalidatePath("/", "layout");
  return error ? { error: readable(error, "Impossible de rapprocher cette ligne.") } : {};
}

export async function unmatchLine(lineId: string): Promise<ActionResult> {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("unmatch_statement_line", { p_line_id: z.uuid().parse(lineId) });
  revalidatePath("/", "layout");
  return error ? { error: readable(error, "Impossible de défaire ce rapprochement.") } : {};
}

export async function setLineIgnored(lineId: string, ignored: boolean): Promise<ActionResult> {
  await requireRole(ACCOUNT_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_statement_line_ignored", { p_line_id: z.uuid().parse(lineId), p_ignored: ignored });
  revalidatePath("/", "layout");
  return error ? { error: readable(error, "Impossible de modifier cette ligne.") } : {};
}
