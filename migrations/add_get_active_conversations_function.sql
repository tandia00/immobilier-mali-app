-- Drop function if it exists
DROP FUNCTION IF EXISTS get_active_conversations(UUID);

-- Function to get active conversations for a user
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
    FROM messages m
    JOIN properties p ON m.property_id = p.id
    WHERE (m.sender_id = input_user_id OR m.receiver_id = input_user_id)
    AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC;
END;
$$ LANGUAGE plpgsql;
