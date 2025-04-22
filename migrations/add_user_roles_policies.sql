-- Enable RLS on user_roles table
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own role
CREATE POLICY "Users can read their own role"
ON user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Allow admins to read all roles
CREATE POLICY "Admins can read all roles"
ON user_roles
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);
