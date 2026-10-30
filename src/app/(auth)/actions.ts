"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { translateAuthError } from "@/lib/auth/errors";
import { clientIp, lockoutMessage } from "@/lib/auth/lockout";
import { clearLoginFailures, loginLockedUntil, recordLoginFailure } from "@/lib/auth/lockout.server";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { publicEnv } from "@/lib/env";
import { type FormState, toFieldErrors } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, passwordSchema, requiredText } from "@/lib/validation";

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Le mot de passe est obligatoire." }),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  // Verrouillage après plusieurs échecs : le mot de passe n'est même pas vérifié
  const target = { email: parsed.data.email, ip: clientIp(await headers()) };
  const lockedUntil = await loginLockedUntil(target);
  if (lockedUntil) {
    return { error: lockoutMessage(lockedUntil) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Compté que le compte existe ou non, pour ne pas révéler les adresses inscrites
    if (error.code === "invalid_credentials") {
      const locked = await recordLoginFailure(target);
      if (locked) {
        return { error: lockoutMessage(locked) };
      }
    }
    return { error: translateAuthError(error) };
  }
  await clearLoginFailures(parsed.data.email);

  redirect(safeRedirectPath(formData.get("suivant")));
}

export async function sendMagicLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: emailSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: false },
  });
  // Réponse identique que le compte existe ou non, pour ne pas révéler les adresses inscrites
  if (error && error.code !== "otp_disabled" && error.code !== "user_not_found") {
    return { error: translateAuthError(error) };
  }
  return { success: "Si un compte existe pour cette adresse, un lien de connexion vient d'être envoyé." };
}

const signUpSchema = z.object({
  fullName: requiredText("Le nom complet"),
  email: emailSchema,
  password: passwordSchema,
});

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }
  if (formData.get("consent") !== "on") {
    return { fieldErrors: { consent: ["Vous devez accepter la politique de confidentialité."] } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });
  if (error) {
    return { error: translateAuthError(error) };
  }
  return {
    success:
      "Compte créé. Un e-mail de confirmation vient de vous être envoyé : cliquez sur le lien pour activer votre compte.",
  };
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: emailSchema }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/reinitialiser-mot-de-passe`,
  });
  if (error && error.code !== "user_not_found") {
    return { error: translateAuthError(error) };
  }
  return {
    success: "Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé.",
  };
}

const updatePasswordSchema = z
  .object({ password: passwordSchema, confirmation: z.string() })
  .refine((data) => data.password === data.confirmation, {
    error: "Les deux mots de passe ne correspondent pas.",
    path: ["confirmation"],
  });

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: translateAuthError(error) };
  }
  redirect("/tableau-de-bord");
}
