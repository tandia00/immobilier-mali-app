-- Modifier la colonne phone_number pour permettre les valeurs null
ALTER TABLE transactions ALTER COLUMN phone_number DROP NOT NULL;

-- Mettre à jour les transactions existantes avec phone_number null
UPDATE transactions SET phone_number = null WHERE phone_number IS NULL;
