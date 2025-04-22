-- Vérifier la définition de la contrainte de vérification sur le transaction_type
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'transactions_transaction_type_check';
