-- Ajouter la colonne updated_at à la table user_reports
ALTER TABLE user_reports ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Mettre à jour les enregistrements existants
UPDATE user_reports SET updated_at = created_at WHERE updated_at IS NULL;

-- Créer une fonction pour mettre à jour automatiquement updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer un trigger pour mettre à jour automatiquement updated_at
DROP TRIGGER IF EXISTS set_updated_at_on_user_reports ON user_reports;
CREATE TRIGGER set_updated_at_on_user_reports
BEFORE UPDATE ON user_reports
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
