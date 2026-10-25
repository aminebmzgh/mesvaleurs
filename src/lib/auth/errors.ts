/** Traduction en français des erreurs renvoyées par Supabase Auth. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Adresse e-mail ou mot de passe incorrect.",
  email_not_confirmed:
    "Votre adresse e-mail n'est pas encore confirmée. Consultez le lien reçu par e-mail.",
  user_already_exists: "Un compte existe déjà avec cette adresse e-mail.",
  email_exists: "Un compte existe déjà avec cette adresse e-mail.",
  weak_password:
    "Mot de passe trop faible : au moins 8 caractères, avec des lettres et des chiffres.",
  same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
  over_request_rate_limit: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  over_email_send_rate_limit:
    "Trop d'e-mails envoyés. Patientez quelques minutes avant de réessayer.",
  otp_expired: "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
  mfa_verification_failed: "Code incorrect. Vérifiez l'heure de votre téléphone et réessayez.",
  mfa_challenge_expired: "Le code a expiré. Saisissez le nouveau code affiché.",
  insufficient_aal: "Cette action nécessite la double authentification.",
  reauthentication_needed: "Pour des raisons de sécurité, reconnectez-vous puis réessayez.",
  signup_disabled: "Les inscriptions sont désactivées.",
  user_not_found: "Aucun compte ne correspond à cette adresse e-mail.",
};

const DEFAULT_MESSAGE = "Une erreur est survenue. Veuillez réessayer.";

export function translateAuthError(error: { code?: string | null } | null | undefined): string {
  if (!error?.code) {
    return DEFAULT_MESSAGE;
  }
  return AUTH_ERROR_MESSAGES[error.code] ?? DEFAULT_MESSAGE;
}
