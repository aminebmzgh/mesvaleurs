-- =============================================================================
-- Assistant IA : chaque question posée compte dans le quota mensuel d'IA de
-- l'entreprise, comme une lecture de facture (une question = un appel, quel que
-- soit le nombre d'échanges avec le modèle pour y répondre).
-- =============================================================================

alter table public.ai_usages drop constraint ai_usages_feature_check;
alter table public.ai_usages add constraint ai_usages_feature_check check (feature in ('invoice_reading', 'assistant'));
