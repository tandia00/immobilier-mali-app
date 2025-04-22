-- Create saved_cards table
create table public.saved_cards (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    last_four varchar(4) not null,
    expiry_month varchar(2) not null,
    expiry_year varchar(2) not null,
    holder_name varchar(255) not null,
    card_type varchar(20) not null,
    is_default boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table public.saved_cards enable row level security;

-- Policy: Users can only view their own cards
create policy "Users can view own cards"
    on public.saved_cards
    for select
    using (auth.uid() = user_id);

-- Policy: Users can insert their own cards
create policy "Users can insert own cards"
    on public.saved_cards
    for insert
    with check (auth.uid() = user_id);

-- Policy: Users can update their own cards
create policy "Users can update own cards"
    on public.saved_cards
    for update
    using (auth.uid() = user_id);

-- Policy: Users can delete their own cards
create policy "Users can delete own cards"
    on public.saved_cards
    for delete
    using (auth.uid() = user_id);

-- Create index for faster queries
create index saved_cards_user_id_idx on public.saved_cards(user_id);

-- Trigger to ensure only one default card per user
create or replace function public.ensure_single_default_card()
returns trigger as $$
begin
    if new.is_default then
        update public.saved_cards
        set is_default = false
        where user_id = new.user_id
        and id != new.id;
    end if;
    return new;
end;
$$ language plpgsql;

create trigger ensure_single_default_card_trigger
    before insert or update on public.saved_cards
    for each row
    execute function public.ensure_single_default_card();
