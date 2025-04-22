-- Drop all existing foreign key constraints
ALTER TABLE user_reports
DROP CONSTRAINT IF EXISTS "fk_reporter" CASCADE,
DROP CONSTRAINT IF EXISTS "fk_reported_user" CASCADE,
DROP CONSTRAINT IF EXISTS "user_reports_reporter_id_fkey" CASCADE,
DROP CONSTRAINT IF EXISTS "user_reports_reported_user_id_fkey" CASCADE,
DROP CONSTRAINT IF EXISTS "user_reports_reporter_id" CASCADE,
DROP CONSTRAINT IF EXISTS "user_reports_reported_user_id" CASCADE;

-- Add clean foreign key constraints
ALTER TABLE user_reports
ADD CONSTRAINT user_reports_reporter_id_fkey
    FOREIGN KEY (reporter_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE,
ADD CONSTRAINT user_reports_reported_user_id_fkey
    FOREIGN KEY (reported_user_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;
