-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Enable read access for all users" ON properties;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON properties;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON properties;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON properties;

-- Activer RLS sur la table properties
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Politique pour la lecture : uniquement les propriétés approuvées sont visibles publiquement
CREATE POLICY "Public can only see approved properties"
ON properties FOR SELECT
USING (
    status = 'approved' OR
    auth.uid() = user_id OR -- Le propriétaire peut voir ses propres propriétés
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    ) -- Les admins peuvent tout voir
);

-- Politique pour l'insertion : les utilisateurs authentifiés peuvent créer
CREATE POLICY "Users can create properties"
ON properties FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
);

-- Politique pour la mise à jour : propriétaire ou admin
CREATE POLICY "Owner or admin can update properties"
ON properties FOR UPDATE
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
)
WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);

-- Politique pour la suppression : propriétaire ou admin
CREATE POLICY "Owner or admin can delete properties"
ON properties FOR DELETE
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    )
);
