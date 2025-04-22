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
    RESET search_path;
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to count unread conversations
CREATE OR REPLACE FUNCTION public.count_unread_conversations(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RESET search_path;
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.messages m
        WHERE m.recipient_id = user_id
        AND m.read_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to ensure single default card
CREATE OR REPLACE FUNCTION public.ensure_single_default_card()
RETURNS TRIGGER AS $$
BEGIN
    RESET search_path;
    IF NEW.is_default THEN
        UPDATE public.payment_methods
        SET is_default = false
        WHERE user_id = NEW.user_id
        AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to get messages status
CREATE OR REPLACE FUNCTION public.get_messages_status(p_property_id BIGINT)
RETURNS TABLE (
    unread_count BIGINT,
    last_message_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RESET search_path;
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS unread_count,
        MAX(created_at) AS last_message_date
    FROM public.messages
    WHERE property_id = p_property_id
    AND receiver_id = auth.uid()
    AND read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to check if user has messages
CREATE OR REPLACE FUNCTION public.has_messages(p_property_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
    RESET search_path;
    RETURN EXISTS (
        SELECT 1
        FROM public.messages
        WHERE property_id = p_property_id
        AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    RESET search_path;
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Function to update reports updated_at
CREATE OR REPLACE FUNCTION public.update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    RESET search_path;
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Recreate triggers
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
    BEFORE UPDATE ON public.properties
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON public.user_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_reports_updated_at();
