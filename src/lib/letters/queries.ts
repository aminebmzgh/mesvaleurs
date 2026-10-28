import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { BUILTIN_LETTER_TEMPLATES, type LetterTemplate } from "./templates";

const UUID = /^[0-9a-f-]{36}$/i;

/** Modèles de lettre d'accompagnement de l'entreprise, par nom. */
export async function listCoverLetterTemplates(): Promise<(LetterTemplate & { updatedAt: string })[]> {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("letter_templates")
    .select("id, name, subject, body, closing, updated_at")
    .eq("organization_id", organization.organizationId)
    .eq("kind", "cover_letter")
    .order("name");
  if (error) {
    throw new Error("Impossible de charger les modèles de lettre.", { cause: error });
  }
  return data.map((t) => ({ key: t.id, name: t.name, subject: t.subject, body: t.body, closing: t.closing, updatedAt: t.updated_at }));
}

/** Modèle intégré (clé) ou modèle de l'entreprise (identifiant) ; null s'il n'existe pas. */
export async function findLetterTemplate(key: string): Promise<LetterTemplate | null> {
  const builtin = BUILTIN_LETTER_TEMPLATES.find((t) => t.key === key);
  if (builtin || !UUID.test(key)) {
    return builtin ?? null;
  }
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data } = await supabase
    .from("letter_templates")
    .select("id, name, subject, body, closing")
    .eq("organization_id", organization.organizationId)
    .eq("id", key)
    .maybeSingle();
  return data ? { key: data.id, name: data.name, subject: data.subject, body: data.body, closing: data.closing } : null;
}
