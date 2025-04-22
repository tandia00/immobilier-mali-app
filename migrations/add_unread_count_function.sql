-- Création de la fonction pour compter les conversations non lues
CREATE OR REPLACE FUNCTION count_unread_conversations(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    PERFORM set_config('search_path', 'public', false);
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM messages m
        WHERE m.recipient_id = user_id
        AND m.read_at IS NULL
    );
END;
$$ LANGUAGE plpgsql;
