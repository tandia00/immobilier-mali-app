-- Temporarily disable RLS
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Add foreign key constraints if they don't exist
DO $$ 
BEGIN 
    -- Add sender_id foreign key
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_messages_sender'
    ) THEN
        ALTER TABLE messages
        ADD CONSTRAINT fk_messages_sender
        FOREIGN KEY (sender_id)
        REFERENCES profiles(id)
        ON DELETE CASCADE;
    END IF;

    -- Add receiver_id foreign key
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_messages_receiver'
    ) THEN
        ALTER TABLE messages
        ADD CONSTRAINT fk_messages_receiver
        FOREIGN KEY (receiver_id)
        REFERENCES profiles(id)
        ON DELETE CASCADE;
    END IF;

END $$;

-- Make sure sender_id and receiver_id are UUID type
DO $$ 
BEGIN 
    -- Convert sender_id to UUID if it's not already
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'sender_id' 
        AND data_type != 'uuid'
    ) THEN
        ALTER TABLE messages
        ALTER COLUMN sender_id TYPE uuid USING sender_id::uuid;
    END IF;

    -- Convert receiver_id to UUID if it's not already
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'messages' 
        AND column_name = 'receiver_id' 
        AND data_type != 'uuid'
    ) THEN
        ALTER TABLE messages
        ALTER COLUMN receiver_id TYPE uuid USING receiver_id::uuid;
    END IF;
END $$;

-- Re-enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Force PostgREST to reload its schema cache
SELECT pg_notify('pgrst', 'reload schema');
NOTIFY pgrst, 'reload schema';
