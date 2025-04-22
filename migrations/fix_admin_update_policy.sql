-- Supprimer la politique problématique existante
DROP POLICY IF EXISTS "Enable update for administrators" ON public.properties;

-- Créer une nouvelle politique correcte pour les administrateurs
CREATE POLICY "Admin can update all properties" 
ON public.properties
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);

-- Vérifier que la politique "Owner or admin can update properties" utilise user_id et non id
DROP POLICY IF EXISTS "Owner or admin can update properties" ON public.properties;

CREATE POLICY "Owner or admin can update properties"
ON public.properties 
FOR UPDATE
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 
        FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);
