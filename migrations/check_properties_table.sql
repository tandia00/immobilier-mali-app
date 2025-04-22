-- Vérifier la structure de la table properties
SELECT 
    column_name, 
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'properties'
ORDER BY ordinal_position;
