-- Ajouter la colonne user_id à la table properties si elle n'existe pas
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'properties' AND column_name = 'user_id') THEN
        ALTER TABLE properties ADD COLUMN user_id UUID;
    END IF;
END $$;

-- Mettre à jour la colonne user_id avec les valeurs existantes si nécessaire
-- (Cette partie dépend de comment les propriétés sont actuellement liées aux utilisateurs)

-- Ajouter la contrainte de clé étrangère
ALTER TABLE properties
    ADD CONSTRAINT properties_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES profiles(id)
    ON DELETE CASCADE;
