-- Script SQL pour ajouter les colonnes manquantes à la table transactions

-- Ajout de la colonne card_last_digits
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS card_last_digits text;

-- Ajout de la colonne transfer_method
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS transfer_method text;

-- Ajout de la colonne transfer_reference
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS transfer_reference text;

-- Ajout de la colonne error_message
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS error_message text;

-- Ajout de la colonne completed_at
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Commentaires sur les colonnes
COMMENT ON COLUMN public.transactions.card_last_digits IS 'Les 4 derniers chiffres de la carte bancaire utilisée pour le paiement';
COMMENT ON COLUMN public.transactions.transfer_method IS 'Méthode utilisée pour le transfert (orange_money, moov_money, bank_account)';
COMMENT ON COLUMN public.transactions.transfer_reference IS 'Référence unique du transfert';
COMMENT ON COLUMN public.transactions.error_message IS 'Message d''erreur en cas d''échec du transfert';
COMMENT ON COLUMN public.transactions.completed_at IS 'Date et heure de finalisation du transfert';
