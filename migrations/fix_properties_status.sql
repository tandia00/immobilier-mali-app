-- Ajouter une valeur par défaut 'pending' à la colonne status
ALTER TABLE properties 
ALTER COLUMN status SET DEFAULT 'pending';

-- Mettre à jour les propriétés existantes qui n'ont pas de statut
UPDATE properties 
SET status = 'pending' 
WHERE status IS NULL;

-- S'assurer que la colonne status n'est pas nullable
ALTER TABLE properties 
ALTER COLUMN status SET NOT NULL;
