-- Ajouter la colonne view_count à la table properties
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0 NOT NULL;
