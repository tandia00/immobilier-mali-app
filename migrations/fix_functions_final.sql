-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_messages_status(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.has_messages(BIGINT) CASCADE;

-- Function to get messages status with immutable search_path
CREATE FUNCTION public.get_messages_status(p_property_id BIGINT)
RETURNS TABLE (
    unread_count BIGINT,
    last_message_date TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS unread_count,
        MAX(created_at) AS last_message_date
    FROM public.messages
    WHERE property_id = p_property_id
    AND receiver_id = auth.uid()
    AND read = false;
END;
$$;

-- Function to check if user has messages with immutable search_path
CREATE FUNCTION public.has_messages(p_property_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.messages
        WHERE property_id = p_property_id
        AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    );
END;
$$;
