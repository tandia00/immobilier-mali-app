-- Désactiver RLS temporairement
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques existantes
DROP POLICY IF EXISTS "basic_user_roles_policy" ON user_roles;
DROP POLICY IF EXISTS "user_roles_read_policy" ON user_roles;
DROP POLICY IF EXISTS "user_roles_write_policy" ON user_roles;

-- Créer une table temporaire pour stocker les administrateurs
CREATE TABLE IF NOT EXISTS admin_list (
    user_id UUID PRIMARY KEY
);

-- Insérer votre ID dans la table admin_list
INSERT INTO admin_list (user_id) 
VALUES ('024fb95e-4ce4-496d-ad41-d1493f87fba9')
ON CONFLICT (user_id) DO NOTHING;

-- Réactiver RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Créer une politique de lecture simple basée sur la table admin_list
CREATE POLICY "simple_read_policy"
ON user_roles
FOR SELECT
USING (
    auth.uid() = user_id OR  -- L'utilisateur peut voir son propre rôle
    auth.uid() IN (SELECT user_id FROM admin_list)  -- Les administrateurs peuvent tout voir
);

-- Créer une politique d'écriture simple basée sur la table admin_list
CREATE POLICY "simple_write_policy"
ON user_roles
FOR ALL
USING (
    auth.uid() IN (SELECT user_id FROM admin_list)  -- Seuls les administrateurs peuvent modifier
);
