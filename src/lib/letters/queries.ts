import "server-only";
import { requireActiveOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { BUILTIN_TEMPLATES, type LetterKind, type LetterTemplate, type TemplateOption } from "./templates";

const UUID = /^[0-9a-f-]{36}$/i;

export type CustomLetterTemplate = LetterTemplate & { kind: LetterKind; updatedAt: string };

/** Modèles de l'entreprise (d'un type de courrier, ou de tous), par nom. */
export async function listLetterTemplates(kind?: LetterKind): Promise<CustomLetterTemplate[]> {
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  let query = supabase
    .from("letter_templates")
    .select("id, kind, name, subject, body, closing, updated_at")
    .eq("organization_id", organization.organizationId)
    .order("name");
  if (kind) {
    query = query.eq("kind", kind);
  }
  const { data, error } = await query;
  if (error) {
    throw new Error("Impossible de charger les modèles de lettre.", { cause: error });
  }
  return data.map((t) => ({
    key: t.id,
    kind: t.kind,
    name: t.name,
    subject: t.subject,
    body: t.body,
    closing: t.closing,
    updatedAt: t.updated_at,
  }));
}

/** Modèles de lettre d'accompagnement de l'entreprise. */
export async function listCoverLetterTemplates() {
  return listLetterTemplates("cover_letter");
}

/** Modèle de l'entreprise, quel que soit son type ; null s'il n'existe pas. */
export async function findCustomTemplate(id: string): Promise<(LetterTemplate & { kind: LetterKind }) | null> {
  if (!UUID.test(id)) {
    return null;
  }
  const organization = await requireActiveOrganization();
  const supabase = await createClient();
  const { data } = await supabase
    .from("letter_templates")
    .select("id, kind, name, subject, body, closing")
    .eq("organization_id", organization.organizationId)
    .eq("id", id)
    .maybeSingle();
  return data ? { key: data.id, kind: data.kind, name: data.name, subject: data.subject, body: data.body, closing: data.closing } : null;
}

/** Modèle intégré (clé) ou modèle de l'entreprise (identifiant) d'un type de courrier ; null s'il n'existe pas. */
export async function findLetterTemplate(key: string, kind: LetterKind = "cover_letter"): Promise<LetterTemplate | null> {
  const builtin = BUILTIN_TEMPLATES[kind].find((t) => t.key === key);
  if (builtin) {
    return builtin;
  }
  const custom = await findCustomTemplate(key);
  return custom?.kind === kind ? custom : null;
}

/**
 * Modèle d'un courrier : celui demandé s'il existe ; sinon le premier modèle de
 * l'entreprise pour ce type (il remplace le modèle intégré), sinon le modèle intégré.
 */
export async function resolveLetterTemplate(kind: LetterKind, key: string | null): Promise<LetterTemplate> {
  const requested = key ? await findLetterTemplate(key, kind) : null;
  if (requested) {
    return requested;
  }
  const [first] = await listLetterTemplates(kind);
  return first ?? BUILTIN_TEMPLATES[kind][0];
}

/** Modèles proposés pour un type de courrier : ceux de l'entreprise, puis les modèles intégrés. */
export async function templateOptions(kind: LetterKind): Promise<TemplateOption[]> {
  const custom = await listLetterTemplates(kind);
  return [
    ...custom.map((t) => ({ key: t.key, name: t.name, custom: true })),
    ...BUILTIN_TEMPLATES[kind].map((t) => ({ key: t.key, name: t.name, custom: false })),
  ];
}
