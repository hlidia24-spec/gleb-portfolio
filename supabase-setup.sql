-- Gleb's Portfolio Studio: one-time setup for Supabase.
-- STEP 1: In Supabase Authentication → Users, create your account with an email and
--         a strong password (disable public sign-ups in Auth settings).
-- STEP 2: Copy YOUR user UUID from Authentication → Users.
-- STEP 3: REPLACE EVERY occurrence of PASTE_YOUR_USER_UUID_HERE below with that UUID.
-- STEP 4: Paste this script into Supabase → SQL Editor and select Run.
-- IMPORTANT: Do not paste your password here or anywhere in your website files.

create table if not exists public.portfolio_data (
  id smallint primary key check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.portfolio_data enable row level security;
revoke all on table public.portfolio_data from anon, authenticated;
grant select on table public.portfolio_data to anon, authenticated;
grant insert, update on table public.portfolio_data to authenticated;

drop policy if exists "Portfolio public read" on public.portfolio_data;
drop policy if exists "Portfolio only owner insert" on public.portfolio_data;
drop policy if exists "Portfolio only owner update" on public.portfolio_data;

create policy "Portfolio public read" on public.portfolio_data
  for select to anon, authenticated using (true);
create policy "Portfolio only owner insert" on public.portfolio_data
  for insert to authenticated
  with check ((select auth.uid())::text = 'PASTE_YOUR_USER_UUID_HERE' and id = 1);
create policy "Portfolio only owner update" on public.portfolio_data
  for update to authenticated
  using ((select auth.uid())::text = 'PASTE_YOUR_USER_UUID_HERE' and id = 1)
  with check ((select auth.uid())::text = 'PASTE_YOUR_USER_UUID_HERE' and id = 1);

-- Uploaded portfolio images will be publicly readable, but uploads require the
-- single approved owner's authenticated session and user-ID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-media','portfolio-media',true,10485760,
  array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Portfolio only owner uploads" on storage.objects;
create policy "Portfolio only owner uploads" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'portfolio-media'
    and (select auth.uid())::text = 'PASTE_YOUR_USER_UUID_HERE'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Uploaded files have unique names; no overwrite or delete permissions are granted.
-- To remove unused uploads from storage, use the Supabase Storage dashboard.
