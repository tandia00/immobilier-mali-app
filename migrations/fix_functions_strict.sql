-- Drop existing functions with CASCADE to remove dependencies
DROP FUNCTION IF EXISTS public.get_messages_status(BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.has_messages(BIGINT) CASCADE;

-- Create get_messages_status function with strict search_path
CREATE FUNCTION public.get_messages_status(p_property_id BIGINT)
    RETURNS TABLE (
        unread_count BIGINT,
        last_message_date TIMESTAMP WITH TIME ZONE
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path FROM CURRENT
AS $$
#variable_conflict use_column
DECLARE
    _search_path text;
BEGIN
    -- Save current search_path
    SELECT current_setting('search_path') INTO _search_path;
    
    -- Set search_path to empty
    PERFORM set_config('search_path', '', false);
    
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS unread_count,
        MAX(created_at) AS last_message_date
    FROM public.messages
    WHERE property_id = p_property_id
    AND receiver_id = auth.uid()
    AND read = false;
    
    -- Restore original search_path
    PERFORM set_config('search_path', _search_path, false);
END;
$$;

-- Create has_messages function with strict search_path
CREATE FUNCTION public.has_messages(p_property_id BIGINT)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path FROM CURRENT
AS $$
#variable_conflict use_column
DECLARE
    _search_path text;
BEGIN
    -- Save current search_path
    SELECT current_setting('search_path') INTO _search_path;
    
    -- Set search_path to empty
    PERFORM set_config('search_path', '', false);
    
    RETURN EXISTS (
        SELECT 1
        FROM public.messages
        WHERE property_id = p_property_id
        AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    );
    
    -- Restore original search_path
    PERFORM set_config('search_path', _search_path, false);
END;
$$;
