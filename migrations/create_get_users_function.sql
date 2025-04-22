-- Créer une fonction pour récupérer les informations des utilisateurs de manière sécurisée
CREATE OR REPLACE FUNCTION get_users_info(user_ids UUID[])
RETURNS TABLE (
    id UUID,
    email TEXT,
    user_metadata JSONB
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Vérifier si l'utilisateur actuel est un admin
    IF NOT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Accès non autorisé';
    END IF;

    RETURN QUERY
    SELECT 
        au.id,
        au.email,
        au.raw_user_meta_data
    FROM auth.users au
    WHERE au.id = ANY(user_ids);
END;
$$;
