-- Supprimer les fonctions existantes si elles existent
drop function if exists get_messages_status(bigint[]);
drop function if exists mark_messages_as_read(bigint[]);

-- Fonction pour obtenir le statut des messages
create or replace function get_messages_status(message_ids bigint[])
returns table (
  id bigint,
  read boolean,
  receiver_id uuid,
  deleted_at timestamp with time zone
) 
language sql
security definer
as $$
  select m.id, m.read, m.receiver_id, m.deleted_at
  from messages m
  where m.id = any(message_ids);
$$;

-- Fonction pour marquer les messages comme lus
create or replace function mark_messages_as_read(message_ids bigint[])
returns setof messages
language plpgsql
security definer
as $$
begin
  return query
  update messages m
  set read = true
  where m.id = any(message_ids)
    and m.deleted_at is null
    and m.read = false
  returning m.*;
end;
$$;
