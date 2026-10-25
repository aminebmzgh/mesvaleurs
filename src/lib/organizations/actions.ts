"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getMemberships, requireUser } from "@/lib/auth/dal";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/config";
import { type FormState, toFieldErrors } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { optionalText, requiredText } from "@/lib/validation";

const ONE_YEAR = 60 * 60 * 24 * 365;

async function setActiveOrganizationCookie(organizationId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

const createOrganizationSchema = z.object({
  name: requiredText("La raison sociale"),
  city: optionalText(120),
});

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const parsed = createOrganizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { data: organizationId, error } = await supabase.rpc("create_organization", {
    p_name: parsed.data.name,
    p_city: parsed.data.city ?? null,
  });
  if (error || !organizationId) {
    return { error: "Impossible de créer l'entreprise. Veuillez réessayer." };
  }

  await setActiveOrganizationCookie(organizationId);
  redirect("/tableau-de-bord");
}

export async function acceptInvitation(invitationId: string) {
  await requireUser();
  const id = z.uuid().parse(invitationId);

  const supabase = await createClient();
  const { data: organizationId, error } = await supabase.rpc("accept_invitation", {
    p_invitation_id: id,
  });
  if (error || !organizationId) {
    redirect("/onboarding?erreur=invitation");
  }

  await setActiveOrganizationCookie(organizationId);
  redirect("/tableau-de-bord");
}

/** Change d'organisation active (l'appartenance est vérifiée côté serveur). */
export async function switchOrganization(organizationId: string) {
  const user = await requireUser();
  const memberships = await getMemberships();
  if (!memberships.some((m) => m.organizationId === organizationId)) {
    redirect("/tableau-de-bord?erreur=acces-refuse");
  }

  await setActiveOrganizationCookie(organizationId);
  const supabase = await createClient();
  await supabase.from("profiles").update({ last_organization_id: organizationId }).eq("id", user.id);
  redirect("/tableau-de-bord");
}
