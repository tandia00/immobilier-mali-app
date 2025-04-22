-- Supprimer toutes les politiques existantes
DROP POLICY IF EXISTS "Users can read their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON user_roles;
DROP POLICY IF EXISTS "Allow users to read their own role" ON user_roles;
DROP POLICY IF EXISTS "Allow admins to manage roles" ON user_roles;

-- Désactiver temporairement RLS pour nettoyer
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Réactiver RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Créer une politique unique et très simple
CREATE POLICY "basic_user_roles_policy"
ON user_roles
FOR ALL
USING (
    -- Permettre l'accès à son propre rôle uniquement
    auth.uid() = user_id
);
