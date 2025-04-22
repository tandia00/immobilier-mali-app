-- Ajouter le champ card_type à la table saved_cards
ALTER TABLE public.saved_cards
ADD COLUMN IF NOT EXISTS card_type varchar(20);

-- Mettre à jour les cartes existantes avec un type par défaut
UPDATE public.saved_cards
SET card_type = 'visa'
WHERE card_type IS NULL;
