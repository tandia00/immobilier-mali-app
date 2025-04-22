-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Users can read their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON user_roles;

-- Enable RLS on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Créer une politique unique et simplifiée
CREATE POLICY "Allow users to read their own role"
ON user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Ajouter une politique pour les opérations d'insertion/mise à jour
CREATE POLICY "Allow admins to manage roles"
ON user_roles
FOR ALL
USING (
    (SELECT role FROM user_roles WHERE user_id = auth.uid()) = 'admin'
);
