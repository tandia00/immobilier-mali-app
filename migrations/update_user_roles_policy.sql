-- Supprimer la politique existante
DROP POLICY IF EXISTS "basic_user_roles_policy" ON user_roles;

-- Créer une nouvelle politique plus permissive pour le débogage
CREATE POLICY "user_roles_read_policy"
ON user_roles
FOR SELECT
USING (true);  -- Permettre temporairement la lecture à tous pour déboguer

-- Créer une politique pour les modifications
CREATE POLICY "user_roles_write_policy"
ON user_roles
FOR ALL
USING (
    EXISTS (
        SELECT 1 
        FROM user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'admin'
    )
);
