-- Add deleted_at column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages(deleted_at);

-- Create function to handle soft deletes
CREATE OR REPLACE FUNCTION soft_delete_messages() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.deleted_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for soft deletes
DROP TRIGGER IF EXISTS trigger_messages_soft_delete ON messages;
CREATE TRIGGER trigger_messages_soft_delete
    BEFORE UPDATE ON messages
    FOR EACH ROW
    WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
    EXECUTE FUNCTION soft_delete_messages();
