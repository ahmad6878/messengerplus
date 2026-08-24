-- ============================================================
-- Messenger+ : схема базы данных для Supabase
-- Выполни этот скрипт целиком в SQL Editor вашего проекта
-- ============================================================

-- 1. Профили пользователей
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2. Сообщения
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users on delete cascade,
  receiver_id uuid not null references auth.users on delete cascade,
  type text not null default 'text', -- text | image | audio
  content text,
  file_url text,
  created_at timestamptz not null default now()
);

create index if not exists messages_sender_idx on public.messages (sender_id, created_at);
create index if not exists messages_receiver_idx on public.messages (receiver_id, created_at);

-- 3. Автосоздание профиля при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(new.raw_user_meta_data->>'username'),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username')
  )
  on conflict (username) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Row Level Security
alter table public.profiles enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profile updatable by owner" on public.profiles;
create policy "profile updatable by owner"
  on public.profiles for update to authenticated using (auth.uid() = id);

drop policy if exists "messages readable by participants" on public.messages;
create policy "messages readable by participants"
  on public.messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "messages insertable by sender" on public.messages;
create policy "messages insertable by sender"
  on public.messages for insert to authenticated
  with check (auth.uid() = sender_id);

-- 5. Realtime для сообщений
alter publication supabase_realtime add table public.messages;

-- 6. Storage: публичный бакет для фото и голосовых
insert into storage.buckets (id, name, public) values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media public read" on storage.objects;
create policy "media public read"
  on storage.objects for select using (bucket_id = 'media');

drop policy if exists "media authenticated upload" on storage.objects;
create policy "media authenticated upload"
  on storage.objects for insert to authenticated with check (bucket_id = 'media');
