"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { ACCOUNT_MANAGER_ROLES } from "@/lib/auth/roles";
import { bankAccountSchema, checkbookSchema, numberWidthFromInput } from "@/lib/bank-accounts/schemas";
import { remainingCount } from "@/lib/checkbooks";
import { type FormState, toFieldErrors } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string };

function bankAccountError(error: { code?: string }): FormState {
  if (error.code === "23505") {
    return { fieldErrors: { rib: ["Ce RIB est déjà enregistré sur un autre compte."] } };
  }
  return { error: "Impossible d'enregistrer le compte. Vérifiez les informations saisies." };
}

export async function createBankAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const parsed = bankAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const { opening_balance_date, ...fields } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      ...fields,
      ...(opening_balance_date ? { opening_balance_date } : {}),
      organization_id: organization.organizationId,
    })
    .select("id")
    .single();
  if (error) {
    return bankAccountError(error);
  }

  revalidatePath("/comptes-bancaires");
  redirect(`/comptes-bancaires/${data.id}`);
}

export async function updateBankAccount(
  accountId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const parsed = bankAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const { opening_balance_date, ...fields } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("bank_accounts")
    .update({ ...fields, ...(opening_balance_date ? { opening_balance_date } : {}) })
    .eq("id", z.uuid().parse(accountId))
    .eq("organization_id", organization.organizationId);
  if (error) {
    return bankAccountError(error);
  }

  revalidatePath("/comptes-bancaires", "layout");
  return { success: "Compte enregistré." };
}

export async function setBankAccountActive(accountId: string, isActive: boolean): Promise<ActionResult> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const supabase = await createClient();
  const { error } = await supabase
    .from("bank_accounts")
    .update({ is_active: isActive })
    .eq("id", z.uuid().parse(accountId))
    .eq("organization_id", organization.organizationId);
  revalidatePath("/comptes-bancaires", "layout");
  return error ? { error: "Impossible de modifier le compte." } : {};
}

export async function createCheckbook(
  accountId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const parsed = checkbookSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const width = numberWidthFromInput(
    String(formData.get("first_number") ?? ""),
    String(formData.get("last_number") ?? ""),
  );
  const supabase = await createClient();
  const { error } = await supabase.from("checkbooks").insert({
    ...parsed.data,
    organization_id: organization.organizationId,
    bank_account_id: z.uuid().parse(accountId),
    next_number: parsed.data.first_number,
    number_width: width,
  });
  if (error) {
    if (error.code === "23P01") {
      return {
        fieldErrors: {
          first_number: ["Ces numéros chevauchent un carnet du même type déjà enregistré sur ce compte."],
        },
      };
    }
    return { error: "Impossible d'enregistrer le carnet." };
  }

  revalidatePath("/comptes-bancaires", "layout");
  return { success: "Carnet enregistré." };
}

export async function setCheckbookArchived(checkbookId: string, archived: boolean): Promise<ActionResult> {
  const organization = await requireRole(ACCOUNT_MANAGER_ROLES);
  const id = z.uuid().parse(checkbookId);
  const supabase = await createClient();
  const { data: checkbook } = await supabase
    .from("checkbooks")
    .select("next_number, last_number")
    .eq("id", id)
    .eq("organization_id", organization.organizationId)
    .maybeSingle();
  if (!checkbook) {
    return { error: "Carnet introuvable." };
  }
  // Un carnet remis en service sans formule restante reste « épuisé »
  const status = archived
    ? "archived"
    : remainingCount(checkbook.next_number, checkbook.last_number) > 0
      ? "active"
      : "exhausted";
  const { error } = await supabase
    .from("checkbooks")
    .update({ status })
    .eq("id", id)
    .eq("organization_id", organization.organizationId);
  revalidatePath("/comptes-bancaires", "layout");
  return error ? { error: "Impossible de modifier le carnet." } : {};
}
