-- Kaizen — Supabase schema
-- Run this in the Supabase SQL editor after creating the project.
-- It assumes auth.users exists (it does by default in Supabase).
--
-- Order: tables first (groups & group_members before check_ins / activity_logs,
-- because their RLS policies reference group_members).

-- ============================================================
-- 1. PROFILES — one row per auth user, created automatically on signup.
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  timezone text not null default 'UTC',
  avatar_emoji text default '🥋',
  total_points integer not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_checkin_date date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- SECURITY DEFINER helper to get the current user's group ids without
-- triggering RLS on group_members (which would recurse).
create or replace function public.user_group_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select group_id from public.group_members where user_id = auth.uid();
$$;

-- Users can always read their own profile.
drop policy if exists "profiles are readable by authenticated users" on public.profiles;
drop policy if exists "users can read their own profile" on public.profiles;
create policy "users can read their own profile"
  on public.profiles for select
  to authenticated using (auth.uid() = id);

-- Group members can read each other's profiles (for leaderboards).
drop policy if exists "users can read group members' profiles" on public.profiles;
create policy "users can read group members' profiles"
  on public.profiles for select
  to authenticated using (
    id in (
      select user_id from public.group_members
      where group_id in (select public.user_group_ids())
    )
  );

drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
  on public.profiles for insert
  to authenticated with check (auth.uid() = id);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update
  to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username',
             split_part(new.email, '@', 1) || '-' || substr(new.id::text, 1, 4)),
    coalesce(new.raw_user_meta_data->>'display_name',
             split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. GROUPS (invite-link only) + GROUP_MEMBERS
-- Defined before check_ins / activity_logs because those reference
-- group_members in their RLS policies.
-- ============================================================
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  invite_code text unique not null default encode(gen_random_bytes(6), 'hex'),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "members can read their groups" on public.groups;
create policy "members can read their groups"
  on public.groups for select
  to authenticated using (
    id in (select public.user_group_ids())
  );

-- Allow reading group metadata by invite_code — needed for the join-preview page.
drop policy if exists "authenticated users can read groups" on public.groups;
create policy "authenticated users can read groups"
  on public.groups for select
  to authenticated using (true);

drop policy if exists "users can create groups" on public.groups;
create policy "users can create groups"
  on public.groups for insert
  to authenticated with check (auth.uid() = created_by);

drop policy if exists "owners can update their groups" on public.groups;
create policy "owners can update their groups"
  on public.groups for update
  to authenticated using (
    exists (
      select 1 from public.group_members
      where group_id = public.groups.id and user_id = auth.uid() and role = 'owner'
    )
  );

drop policy if exists "owners can delete their groups" on public.groups;
create policy "owners can delete their groups"
  on public.groups for delete
  to authenticated using (
    exists (
      select 1 from public.group_members
      where group_id = public.groups.id and user_id = auth.uid() and role = 'owner'
    )
  );

drop policy if exists "members read their group's members" on public.group_members;
create policy "members read their group's members"
  on public.group_members for select
  to authenticated using (
    group_id in (select public.user_group_ids())
  );

drop policy if exists "users can join groups (as self)" on public.group_members;
create policy "users can join groups (as self)"
  on public.group_members for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "users can leave groups (delete self)" on public.group_members;
create policy "users can leave groups (delete self)"
  on public.group_members for delete
  to authenticated using (auth.uid() = user_id);

-- Auto-add the creator as an owner member.
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- ============================================================
-- 3. DAILY CHECK-INS — one row per user per local date.
-- ============================================================
create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  local_date date not null,
  base_points integer not null default 0,
  multiplier numeric(4,2) not null default 1.00,
  total_points integer not null default 0,
  streak_days integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date)
);

alter table public.check_ins enable row level security;

drop policy if exists "users read their own check-ins" on public.check_ins;
create policy "users read their own check-ins"
  on public.check_ins for select
  to authenticated using (auth.uid() = user_id);

drop policy if exists "users read group members' check-ins" on public.check_ins;
create policy "users read group members' check-ins"
  on public.check_ins for select
  to authenticated using (
    user_id in (
      select user_id from public.group_members
      where group_id in (select public.user_group_ids())
    )
  );

drop policy if exists "users write their own check-ins" on public.check_ins;
create policy "users write their own check-ins"
  on public.check_ins for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update their own check-ins" on public.check_ins;
create policy "users update their own check-ins"
  on public.check_ins for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own check-ins" on public.check_ins;
create policy "users delete their own check-ins"
  on public.check_ins for delete
  to authenticated using (auth.uid() = user_id);

-- ============================================================
-- 4. ACTIVITY LOGS — one row per activity done on a check-in.
-- ============================================================
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references public.check_ins(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id text not null,
  points integer not null default 0,
  duration_min integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_user_activity_idx
  on public.activity_logs (user_id, activity_id);
create index if not exists activity_logs_check_in_idx
  on public.activity_logs (check_in_id);

alter table public.activity_logs enable row level security;

drop policy if exists "users read their own logs" on public.activity_logs;
create policy "users read their own logs"
  on public.activity_logs for select
  to authenticated using (auth.uid() = user_id);

drop policy if exists "users read group members' logs" on public.activity_logs;
create policy "users read group members' logs"
  on public.activity_logs for select
  to authenticated using (
    user_id in (
      select user_id from public.group_members
      where group_id in (select public.user_group_ids())
    )
  );

drop policy if exists "users write their own logs" on public.activity_logs;
create policy "users write their own logs"
  on public.activity_logs for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update their own logs" on public.activity_logs;
create policy "users update their own logs"
  on public.activity_logs for update
  to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own logs" on public.activity_logs;
create policy "users delete their own logs"
  on public.activity_logs for delete
  to authenticated using (auth.uid() = user_id);
