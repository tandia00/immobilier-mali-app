-- Function to soft delete a conversation
CREATE OR REPLACE FUNCTION soft_delete_conversation(message_ids UUID[])
RETURNS void AS $$
BEGIN
    UPDATE messages 
    SET deleted_at = CURRENT_TIMESTAMP 
    WHERE id = ANY(message_ids)
    AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;
