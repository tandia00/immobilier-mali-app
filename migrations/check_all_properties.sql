-- Vérifier toutes les propriétés et leur statut
SELECT 
    p.id,
    p.title,
    p.status,
    p.created_at,
    u.email as user_email,
    u.raw_user_meta_data->>'name' as user_name
FROM properties p
LEFT JOIN auth.users u ON u.id = p.user_id
ORDER BY p.created_at DESC;
