-- Désactiver RLS sur la table user_roles
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques existantes
DROP POLICY IF EXISTS "basic_user_roles_policy" ON user_roles;
DROP POLICY IF EXISTS "user_roles_read_policy" ON user_roles;
DROP POLICY IF EXISTS "user_roles_write_policy" ON user_roles;
DROP POLICY IF EXISTS "simple_read_policy" ON user_roles;
DROP POLICY IF EXISTS "simple_write_policy" ON user_roles;

-- S'assurer que votre rôle admin existe
INSERT INTO user_roles (user_id, role)
VALUES ('024fb95e-4ce4-496d-ad41-d1493f87fba9', 'admin')
ON CONFLICT (user_id) DO UPDATE 
SET role = 'admin';

-- Créer une politique très simple sans aucune récursion
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read_own_role"
ON user_roles
FOR SELECT
USING (
    auth.uid() = user_id  -- Chaque utilisateur peut uniquement voir son propre rôle
);
