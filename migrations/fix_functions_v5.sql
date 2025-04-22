-- Drop existing functions
DROP FUNCTION IF EXISTS public.get_messages_status(BIGINT);
DROP FUNCTION IF EXISTS public.has_messages(BIGINT);

-- Recreate get_messages_status with Supabase recommended syntax
CREATE OR REPLACE FUNCTION public.get_messages_status(p_property_id BIGINT)
RETURNS TABLE (
    unread_count BIGINT,
    last_message_date TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Set a secure search_path
    SET search_path TO 'public';
    
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

-- Recreate has_messages with Supabase recommended syntax
CREATE OR REPLACE FUNCTION public.has_messages(p_property_id BIGINT)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Set a secure search_path
    SET search_path TO 'public';
    
    RETURN EXISTS (
        SELECT 1
        FROM public.messages
        WHERE property_id = p_property_id
        AND (sender_id = auth.uid() OR receiver_id = auth.uid())
    );
END;
$$;
