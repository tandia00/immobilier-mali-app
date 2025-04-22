-- Supprimer la contrainte existante
ALTER TABLE transactions DROP CONSTRAINT transactions_status_check;

-- Recréer la contrainte avec toutes les valeurs autorisées
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check 
CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'pending_seller_info'));