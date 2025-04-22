-- Supprimer la contrainte existante
ALTER TABLE transactions DROP CONSTRAINT transactions_transaction_type_check;

-- Recréer la contrainte avec les valeurs autorisées
ALTER TABLE transactions ADD CONSTRAINT transactions_transaction_type_check 
CHECK (transaction_type IN ('sale', 'rent'));
