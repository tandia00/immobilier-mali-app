-- Add country column to profiles table
DO $$ 
BEGIN 
    -- Add country column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'country'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN country TEXT DEFAULT 'Mali';
    END IF;
END $$;

-- Make sure the policy is correct
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
    ON profiles 
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
