-- Création de la table des favoris
CREATE TABLE IF NOT EXISTS favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    property_id BIGINT REFERENCES properties(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(user_id, property_id)
);

-- Création de la table de l'historique de recherche
CREATE TABLE IF NOT EXISTS search_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    search_query TEXT NOT NULL,
    filters JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Ajout des politiques de sécurité pour les favoris
CREATE POLICY "Users can view their own favorites"
    ON favorites
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites"
    ON favorites
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
    ON favorites
    FOR DELETE
    USING (auth.uid() = user_id);

-- Ajout des politiques de sécurité pour l'historique de recherche
CREATE POLICY "Users can view their own search history"
    ON search_history
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can add to their search history"
    ON search_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their search history"
    ON search_history
    FOR DELETE
    USING (auth.uid() = user_id);

-- Activer RLS sur les nouvelles tables
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
