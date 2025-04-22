-- Migration complète pour la gestion des messages supprimés

-- 1. Ajouter la colonne deleted_at si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
        CREATE INDEX idx_messages_deleted_at ON messages(deleted_at);
    END IF;
END $$;

-- 2. Supprimer d'abord les triggers puis les fonctions (ordre des dépendances)
DROP TRIGGER IF EXISTS trigger_messages_soft_delete ON messages;
DROP FUNCTION IF EXISTS soft_delete_messages();
DROP FUNCTION IF EXISTS soft_delete_conversation(UUID[]);
DROP FUNCTION IF EXISTS get_active_conversations(UUID);

-- 3. Créer la fonction trigger pour les suppressions
CREATE OR REPLACE FUNCTION soft_delete_messages()
RETURNS TRIGGER AS $$
BEGIN
    NEW.deleted_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Créer ou remplacer le trigger
CREATE TRIGGER trigger_messages_soft_delete
    BEFORE UPDATE ON messages
    FOR EACH ROW
    WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
    EXECUTE FUNCTION soft_delete_messages();

-- 5. Fonction pour obtenir les conversations actives
CREATE OR REPLACE FUNCTION get_active_conversations(input_user_id UUID)
RETURNS TABLE (
    id UUID,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    read BOOLEAN,
    deleted_at TIMESTAMP WITH TIME ZONE,
    sender_id UUID,
    receiver_id UUID,
    property_id UUID,
    properties JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH conversation_groups AS (
        -- Regrouper les messages par conversation et vérifier s'ils sont tous supprimés
        SELECT 
            m.property_id,
            CASE 
                WHEN m.sender_id = input_user_id THEN m.receiver_id
                ELSE m.sender_id
            END as other_user_id,
            bool_and(m.deleted_at IS NOT NULL) as all_deleted,
            count(*) FILTER (WHERE m.deleted_at IS NULL) as active_messages_count
        FROM messages m
        WHERE (m.sender_id = input_user_id OR m.receiver_id = input_user_id)
        GROUP BY 
            m.property_id,
            CASE 
                WHEN m.sender_id = input_user_id THEN m.receiver_id
                ELSE m.sender_id
            END
        HAVING count(*) FILTER (WHERE m.deleted_at IS NULL) > 0
    ),
    latest_messages AS (
        -- Sélectionner le dernier message non supprimé de chaque conversation
        SELECT DISTINCT ON (m.property_id, cg.other_user_id)
            m.id,
            m.content,
            m.created_at,
            m.read,
            m.deleted_at,
            m.sender_id,
            m.receiver_id,
            m.property_id
        FROM messages m
        JOIN conversation_groups cg ON 
            m.property_id = cg.property_id AND
            (
                CASE 
                    WHEN m.sender_id = input_user_id THEN m.receiver_id
                    ELSE m.sender_id
                END = cg.other_user_id
            )
        WHERE 
            (m.sender_id = input_user_id OR m.receiver_id = input_user_id)
            AND m.deleted_at IS NULL
        ORDER BY 
            m.property_id,
            cg.other_user_id,
            m.created_at DESC
    )
    SELECT 
        m.id,
        m.content,
        m.created_at,
        m.read,
        m.deleted_at,
        m.sender_id,
        m.receiver_id,
        m.property_id,
        jsonb_build_object(
            'id', p.id,
            'title', p.title,
            'type', p.type,
            'images', p.images,
            'price', p.price,
            'transaction_type', p.transaction_type,
            'city', p.city
        ) AS properties
    FROM latest_messages m
    JOIN properties p ON m.property_id = p.id
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 6. Fonction pour supprimer une conversation
CREATE OR REPLACE FUNCTION soft_delete_conversation(message_ids UUID[])
RETURNS void AS $$
BEGIN
    UPDATE messages 
    SET deleted_at = CURRENT_TIMESTAMP 
    WHERE id = ANY(message_ids)
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. Fonction pour supprimer définitivement les messages
CREATE OR REPLACE FUNCTION permanently_delete_messages(
    user_id UUID,
    target_property_id UUID,
    target_other_user_id UUID
)
RETURNS void AS $$
BEGIN
    -- Supprimer définitivement les messages de la conversation
    DELETE FROM messages
    WHERE property_id = target_property_id
    AND (
        (sender_id = user_id AND receiver_id = target_other_user_id)
        OR 
        (sender_id = target_other_user_id AND receiver_id = user_id)
    )
    AND deleted_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
