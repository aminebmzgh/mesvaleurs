/**
 * Valide une destination de redirection fournie par l'utilisateur (paramètre
 * « suivant ») : seuls les chemins internes sont acceptés, pour éviter les
 * redirections ouvertes vers un site tiers.
 */
export function safeRedirectPath(value: unknown, fallback = "/tableau-de-bord"): string {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return fallback;
  }
  // « //exemple.com » et « /\exemple.com » sont interprétés comme des URL externes
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
