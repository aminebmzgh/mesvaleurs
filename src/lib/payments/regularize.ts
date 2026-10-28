import "server-only";
import { todayIso } from "@/lib/dates";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Après l'émission d'un remplaçant (chèque, LCN ou virement), régularise le paiement
 * rejeté qu'il remplace. Renvoie un avertissement si la régularisation échoue : le
 * nouveau paiement reste émis, la régularisation peut être refaite depuis la liste.
 */
export async function regularizeByReplacement(
  supabase: Client,
  rejectedPaymentId: string | undefined,
  replacementPaymentId: string,
  method: "replacement" | "transfer",
): Promise<string | undefined> {
  if (!rejectedPaymentId) {
    return undefined;
  }
  const { error } = await supabase.rpc("regularize_payment", {
    p_payment_id: rejectedPaymentId,
    p_method: method,
    p_regularized_on: todayIso(),
    p_replacement_payment_id: replacementPaymentId,
  });
  return error ? "Le paiement est émis, mais la régularisation du paiement rejeté a échoué." : undefined;
}
