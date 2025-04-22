-- Mettre à jour les transactions existantes avec transaction_type = 'purchase'
UPDATE transactions
SET transaction_type = 'sale'
WHERE transaction_type = 'purchase';
