import { createHash } from "node:crypto";

/**
 * Verrouillage après échecs de connexion : seuils par adresse e-mail (protège un
 * compte) et par adresse IP (freine l'essai de nombreux comptes depuis un même poste).
 */
export const LOCKOUT_POLICY = {
  email: { maxFailures: 5, window: 15, lock: 15 },
  ip: { maxFailures: 30, window: 15, lock: 15 },
} as const satisfies Record<string, { maxFailures: number; window: number; lock: number }>;

export type LockoutKind = keyof typeof LOCKOUT_POLICY;

/** Empreinte stockée : l'adresse e-mail ou IP n'est jamais conservée en clair. */
export function lockoutKey(kind: LockoutKind, value: string): string {
  return createHash("sha256").update(`${kind}:${value.trim().toLowerCase()}`).digest("hex");
}

/** Adresse IP du visiteur d'après les en-têtes du proxy (Vercel), ou null. */
export function clientIp(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || null;
}

export function lockoutMessage(until: Date, now = new Date()): string {
  const minutes = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
  return `Trop de tentatives de connexion échouées. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}, ou réinitialisez votre mot de passe.`;
}
