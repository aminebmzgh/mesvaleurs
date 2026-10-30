import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { LOCKOUT_POLICY, type LockoutKind, lockoutKey } from "./lockout";

type Target = { email: string; ip: string | null };

const keysOf = ({ email, ip }: Target) =>
  [{ kind: "email" as const, key: lockoutKey("email", email) }, ...(ip ? [{ kind: "ip" as const, key: lockoutKey("ip", ip) }] : [])] satisfies {
    kind: LockoutKind;
    key: string;
  }[];

/**
 * Fin du verrouillage en cours pour cette adresse e-mail ou cette IP, ou null.
 * En cas d'erreur de la base, la connexion n'est pas bloquée (Supabase Auth limite
 * déjà le nombre de tentatives).
 */
export async function loginLockedUntil(target: Target): Promise<Date | null> {
  const { data, error } = await createAdminClient().rpc("login_locked_until", { p_keys: keysOf(target).map(({ key }) => key) });
  if (error) {
    console.error("Verrouillage de connexion : lecture impossible", error.code);
    return null;
  }
  return data ? new Date(data) : null;
}

/** Enregistre un échec ; renvoie la fin du verrouillage s'il vient d'être atteint. */
export async function recordLoginFailure(target: Target): Promise<Date | null> {
  const admin = createAdminClient();
  const results = await Promise.all(
    keysOf(target).map(({ kind, key }) => {
      const policy = LOCKOUT_POLICY[kind];
      return admin.rpc("record_login_failure", {
        p_key: key,
        p_max_failures: policy.maxFailures,
        p_window: `${policy.window} minutes`,
        p_lock: `${policy.lock} minutes`,
      });
    }),
  );
  const until = results
    .map(({ data }) => (data ? new Date(data) : null))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime());
  return until[0] ?? null;
}

/** Connexion réussie : seul le compteur de l'adresse e-mail est effacé (pas celui de l'IP). */
export async function clearLoginFailures(email: string): Promise<void> {
  await createAdminClient().rpc("clear_login_failures", { p_key: lockoutKey("email", email) });
}
