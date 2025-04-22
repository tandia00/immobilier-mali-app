-- Sauvegarde des données existantes et modification de la structure
-- 1. Ajouter une nouvelle colonne UUID
ALTER TABLE transactions ADD COLUMN property_id_new uuid;

-- 2. Mettre à jour la nouvelle colonne avec des UUID générés
UPDATE transactions SET property_id_new = gen_random_uuid();

-- 3. Supprimer l'ancienne colonne
ALTER TABLE transactions DROP COLUMN property_id;

-- 4. Renommer la nouvelle colonne
ALTER TABLE transactions RENAME COLUMN property_id_new TO property_id;
