-- Ajout des colonnes de vérification dans la table properties
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS title_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS description_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS image_verified BOOLEAN DEFAULT FALSE;

-- Mise à jour des politiques de sécurité pour les nouvelles colonnes
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre aux administrateurs de mettre à jour les colonnes de vérification
CREATE POLICY "Enable update for administrators" ON public.properties
FOR UPDATE
USING (
    EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_roles.id = auth.uid()
        AND user_roles.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_roles.id = auth.uid()
        AND user_roles.role = 'admin'
    )
);
