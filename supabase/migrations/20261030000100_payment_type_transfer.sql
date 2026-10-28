-- Virement : nouveau mode de paiement (une valeur d'enum ne peut être utilisée
-- que dans une transaction ultérieure, d'où cette migration séparée).
alter type public.payment_type add value if not exists 'transfer';
