-- Vérifier la définition de la contrainte de vérification sur le status
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'transactions_status_check';
