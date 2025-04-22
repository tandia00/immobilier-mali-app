-- Drop all existing functions
DROP FUNCTION IF EXISTS public.ensure_single_default_card() CASCADE;
DROP FUNCTION IF EXISTS public.count_unread_conversations(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_messages_status(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_reports_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.has_messages(BIGINT) CASCADE;

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    PERFORM set_config('search_path', 'public', false);
    RETURN EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to count unread conversations
CREATE OR REPLACE FUNCTION public.count_unread_conversations(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    PERFORM set_config('search_path', 'public', false);
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM messages m
        WHERE m.recipient_id = user_id
        AND m.read_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to ensure single default card
CREATE OR REPLACE FUNCTION public.ensure_single_default_card()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM set_config('search_path', 'public', false);
    IF NEW.is_default THEN
        UPDATE payment_methods
        SET is_default = false
        WHERE user_id = NEW.user_id
        AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get messages status
CREATE OR REPLACE FUNCTION public.get_messages_status(p_property_id BIGINT)
RETURNS TABLE (
    unread_count BIGINT,
    last_message_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    PERFORM set_config('search_path', 'public', false);
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS unread_count,
        MAX(created_at) AS last_message_date
    FROM messages
    WHERE property_id = p_property_id
    AND receiver_id = auth.uid()
    AND read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has messages
CREATE OR REPLACE FUNCTION public.has_messages(p_property_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    PERFORM set_config('search_path', 'public', false);
    RETURN EXISTS (
        SELECT 1
        FROM messages
        WHERE property_id = p_property_id
        AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM set_config('search_path', 'public', false);
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update reports updated_at
CREATE OR REPLACE FUNCTION public.update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM set_config('search_path', 'public', false);
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON user_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();
