-- Supprimer les contraintes existantes
ALTER TABLE user_reports
DROP CONSTRAINT fk_reporter,
DROP CONSTRAINT fk_reported_user;

-- Ajouter les nouvelles contraintes vers la table profiles
ALTER TABLE user_reports
ADD CONSTRAINT fk_reporter
    FOREIGN KEY(reporter_id) 
    REFERENCES profiles(id)
    ON DELETE CASCADE,
ADD CONSTRAINT fk_reported_user
    FOREIGN KEY(reported_user_id) 
    REFERENCES profiles(id)
    ON DELETE CASCADE;

-- Mettre à jour les politiques de sécurité
DROP POLICY IF EXISTS "Users can view their own reports" ON user_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON user_reports;
DROP POLICY IF EXISTS "Users can create reports" ON user_reports;

CREATE POLICY "Users can view their own reports"
ON user_reports FOR SELECT
TO authenticated
USING (
    auth.uid() = reporter_id
);

CREATE POLICY "Admins can view all reports"
ON user_reports FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);

CREATE POLICY "Users can create reports"
ON user_reports FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = reporter_id
);
