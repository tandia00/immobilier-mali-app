-- Supprimer toutes les politiques existantes de la table properties
BEGIN;
    -- Supprimer toutes les politiques existantes
    DROP POLICY IF EXISTS "Public can only see approved properties" ON properties;
    DROP POLICY IF EXISTS "Users can create properties" ON properties;
    DROP POLICY IF EXISTS "Owner or admin can update properties" ON properties;
    DROP POLICY IF EXISTS "Owner or admin can delete properties" ON properties;
    DROP POLICY IF EXISTS "Enable read access for all users" ON properties;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON properties;
    DROP POLICY IF EXISTS "Enable update for users based on user_id" ON properties;
    DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON properties;

    -- Activer RLS sur la table properties
    ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

    -- Politique pour la lecture publique : uniquement les propriétés approuvées
    CREATE POLICY "Public can only see approved properties"
    ON properties FOR SELECT
    USING (
        status = 'approved' OR -- Propriétés approuvées visibles par tous
        auth.uid() = user_id OR -- Le propriétaire voit ses propriétés
        EXISTS ( -- Les admins voient tout
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

    -- Politique pour l'insertion
    CREATE POLICY "Users can create properties"
    ON properties FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

    -- Politique pour la mise à jour
    CREATE POLICY "Owner or admin can update properties"
    ON properties FOR UPDATE
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

    -- Politique pour la suppression
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
COMMIT;
