"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { ROLES } from "@/lib/auth/roles";
import { publicEnv } from "@/lib/env";
import { type FormState, toFieldErrors } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/app";
import { emailSchema } from "@/lib/validation";
import { parseCeiling } from "@/lib/payments/approvals";

const roleSchema = z.enum(ROLES as [AppRole, ...AppRole[]], { error: "Rôle invalide." });

const inviteSchema = z.object({ email: emailSchema, role: roleSchema });

export async function inviteMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await requireRole(["admin"]);
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }
  const { email, role } = parsed.data;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("memberships")
    .select("id, profiles!inner ( email )")
    .eq("organization_id", organization.organizationId)
    .eq("profiles.email", email)
    .maybeSingle();
  if (existing) {
    return { fieldErrors: { email: ["Cette personne est déjà membre de l'entreprise."] } };
  }

  // L'invitation est créée avec la session de l'administrateur : la RLS s'applique.
  const { data: currentUser } = await supabase.auth.getClaims();
  const { error: insertError } = await supabase.from("invitations").insert({
    organization_id: organization.organizationId,
    email,
    role,
    invited_by: currentUser?.claims.sub ?? null,
  });
  if (insertError) {
    if (insertError.code === "23505") {
      return { fieldErrors: { email: ["Une invitation est déjà en attente pour cette adresse."] } };
    }
    // Limite d'utilisateurs de l'offre
    return { error: insertError.code === "P0001" ? insertError.message : "Impossible de créer l'invitation." };
  }

  // Nouveau compte : Supabase envoie l'e-mail d'invitation (modèle « invite »).
  // Compte existant : l'invitation apparaîtra à sa prochaine connexion.
  const { error: inviteError } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
  });

  revalidatePath("/parametres/membres");
  if (inviteError && inviteError.code === "email_exists") {
    return {
      success: `${email} a déjà un compte : l'invitation lui sera proposée à sa prochaine connexion.`,
    };
  }
  if (inviteError) {
    return {
      error: "L'invitation est enregistrée, mais l'e-mail n'a pas pu être envoyé. Réessayez plus tard.",
    };
  }
  return { success: `Invitation envoyée à ${email}.` };
}

export type ActionResult = { error?: string };

export async function revokeInvitation(invitationId: string): Promise<ActionResult> {
  const organization = await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("invitations")
    .delete()
    .eq("id", z.uuid().parse(invitationId))
    .eq("organization_id", organization.organizationId);
  revalidatePath("/parametres/membres");
  return error ? { error: "Impossible d'annuler l'invitation." } : {};
}

export async function changeMemberRole(membershipId: string, role: string): Promise<ActionResult> {
  const organization = await requireRole(["admin"]);
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) {
    return { error: "Rôle invalide." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ role: parsedRole.data })
    .eq("id", z.uuid().parse(membershipId))
    .eq("organization_id", organization.organizationId);
  revalidatePath("/parametres/membres");
  if (error) {
    return { error: error.code === "P0001" ? error.message : "Impossible de modifier le rôle." };
  }
  return {};
}

export async function removeMember(membershipId: string): Promise<ActionResult> {
  const organization = await requireRole(["admin"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("id", z.uuid().parse(membershipId))
    .eq("organization_id", organization.organizationId);
  revalidatePath("/parametres/membres");
  if (error) {
    return { error: error.code === "P0001" ? error.message : "Impossible de retirer ce membre." };
  }
  return {};
}

/** Plafond journalier d'un membre (double signature) : vide = aucun plafond. */
export async function setMemberCeiling(membershipId: string, amount: string): Promise<ActionResult> {
  const organization = await requireRole(["admin"]);
  const ceiling = parseCeiling(amount);
  if (ceiling === undefined) {
    return { error: "Plafond invalide (exemple : 50 000,00)." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .update({ daily_ceiling: ceiling })
    .eq("id", z.uuid().parse(membershipId))
    .eq("organization_id", organization.organizationId);
  revalidatePath("/parametres/membres");
  return error ? { error: "Impossible d'enregistrer le plafond." } : {};
}
