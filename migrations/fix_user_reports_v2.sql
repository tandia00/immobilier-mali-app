-- Drop existing foreign key constraints if they exist
ALTER TABLE user_reports
DROP CONSTRAINT IF EXISTS user_reports_reporter_id_fkey CASCADE,
DROP CONSTRAINT IF EXISTS user_reports_reported_user_id_fkey CASCADE;

-- Add new foreign key constraints referencing profiles
ALTER TABLE user_reports
ADD CONSTRAINT user_reports_reporter_id_fkey
    FOREIGN KEY (reporter_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE,
ADD CONSTRAINT user_reports_reported_user_id_fkey
    FOREIGN KEY (reported_user_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;

-- Update RLS policies for user_reports
DROP POLICY IF EXISTS "Users can view their own reports" ON user_reports;
DROP POLICY IF EXISTS "Admins can view all reports" ON user_reports;
DROP POLICY IF EXISTS "Users can create reports" ON user_reports;

-- Enable RLS
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own reports"
ON user_reports FOR SELECT
TO authenticated
USING (
    auth.uid() = reporter_id OR
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);

CREATE POLICY "Users can create reports"
ON user_reports FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = reporter_id
);

CREATE POLICY "Admins can manage reports"
ON user_reports FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
);
