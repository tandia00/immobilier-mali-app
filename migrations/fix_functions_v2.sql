-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_messages_status(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.has_messages(BIGINT) CASCADE;

-- Recreate get_messages_status with fixed search_path
CREATE FUNCTION public.get_messages_status(p_property_id BIGINT)
    RETURNS TABLE (
        unread_count BIGINT,
        last_message_date TIMESTAMP WITH TIME ZONE
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path FROM CURRENT
    SET search_path = 'public'
AS $$
DECLARE
    _current_search_path text;
BEGIN
    -- Store the current search_path
    SELECT current_setting('search_path') INTO _current_search_path;
    
    -- Set search_path to public explicitly
    PERFORM set_config('search_path', 'public', true);
    
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS unread_count,
        MAX(created_at) AS last_message_date
    FROM public.messages
    WHERE property_id = p_property_id
    AND receiver_id = auth.uid()
    AND read = false;
    
    -- Restore the original search_path
    PERFORM set_config('search_path', _current_search_path, true);
END;
$$;

-- Recreate has_messages with fixed search_path
CREATE FUNCTION public.has_messages(p_property_id BIGINT)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path FROM CURRENT
    SET search_path = 'public'
AS $$
DECLARE
    _current_search_path text;
BEGIN
    -- Store the current search_path
    SELECT current_setting('search_path') INTO _current_search_path;
    
    -- Set search_path to public explicitly
    PERFORM set_config('search_path', 'public', true);
    
    RETURN EXISTS (
        SELECT 1
        FROM public.messages
        WHERE property_id = p_property_id
        AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    );
    
    -- Restore the original search_path
    PERFORM set_config('search_path', _current_search_path, true);
END;
$$;
