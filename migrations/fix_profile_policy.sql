-- Drop existing policy
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Recreate the policy with correct syntax
CREATE POLICY "Users can update their own profile"
    ON profiles 
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
