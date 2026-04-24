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

-- Helper: is the current user the owner of a given group?
-- SECURITY DEFINER so the internal lookup bypasses RLS on group_members
-- (otherwise the delete policy below would recurse into group_members).
create or replace function public.is_group_owner(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'owner'
  );
$$;

drop policy if exists "owners can remove members" on public.group_members;
create policy "owners can remove members"
  on public.group_members for delete
  to authenticated using (public.is_group_owner(group_id));

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

-- ============================================================
-- 5. CHALLENGES — scoped to a group, created by the owner.
-- A challenge measures a metric over a date window. When the
-- deadline passes and someone views the group, finalize_challenge()
-- picks a winner and awards points.
-- ============================================================
alter table public.group_members
  add column if not exists group_points integer not null default 0;

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  -- activity_id is null for "active_days" challenges (any check-in counts).
  activity_id text,
  metric_type text not null check (metric_type in (
    'count_days', 'sum_duration_min', 'sum_detail', 'sum_points', 'active_days'
  )),
  -- detail_key is required when metric_type = 'sum_detail'. Points at a key
  -- inside activity_logs.details (e.g. 'distance_km', 'pages').
  detail_key text,
  unit text,
  starts_at date not null,
  ends_at date not null check (ends_at >= starts_at),
  reward_points integer not null default 0,
  finalized_at timestamptz,
  winner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists challenges_group_idx
  on public.challenges (group_id, ends_at);
create index if not exists challenges_open_idx
  on public.challenges (ends_at) where finalized_at is null;

alter table public.challenges enable row level security;

drop policy if exists "members read group challenges" on public.challenges;
create policy "members read group challenges"
  on public.challenges for select
  to authenticated using (
    group_id in (select public.user_group_ids())
  );

drop policy if exists "owners create challenges" on public.challenges;
create policy "owners create challenges"
  on public.challenges for insert
  to authenticated with check (
    public.is_group_owner(group_id) and auth.uid() = created_by
  );

drop policy if exists "owners update challenges" on public.challenges;
create policy "owners update challenges"
  on public.challenges for update
  to authenticated
  using (public.is_group_owner(group_id))
  with check (public.is_group_owner(group_id));

drop policy if exists "owners delete challenges" on public.challenges;
create policy "owners delete challenges"
  on public.challenges for delete
  to authenticated using (public.is_group_owner(group_id));

-- finalize_challenge(cid): if the challenge is past its deadline and not
-- yet finalized, pick a winner from the group's member metric scores and
-- award reward_points to both profiles.total_points (journey) and
-- group_members.group_points (group ranking). Idempotent — safe to call
-- repeatedly; no-ops if already finalized or not yet due.
--
-- SECURITY DEFINER so the internal lookups bypass RLS and so no caller can
-- inject a fake winner (the winner is computed entirely in SQL).
create or replace function public.finalize_challenge(cid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.challenges;
  w uuid;
begin
  select * into c from public.challenges
  where id = cid and finalized_at is null and ends_at < current_date
  for update;

  if not found then return; end if;

  with logs as (
    select al.user_id, ci.local_date, al.points, al.duration_min, al.details
    from public.activity_logs al
    join public.check_ins ci on ci.id = al.check_in_id
    where ci.local_date >= c.starts_at
      and ci.local_date <= c.ends_at
      and al.user_id in (
        select user_id from public.group_members where group_id = c.group_id
      )
      and (c.activity_id is null or al.activity_id = c.activity_id)
  ),
  scored as (
    select user_id,
      count(distinct local_date) as days,
      coalesce(sum(duration_min), 0) as total_duration,
      coalesce(sum(points), 0) as total_points,
      coalesce(sum(
        case
          when c.detail_key is not null
               and (details ->> c.detail_key) ~ '^-?[0-9]+(\.[0-9]+)?$'
            then (details ->> c.detail_key)::numeric
          else 0
        end
      ), 0) as detail_sum
    from logs
    group by user_id
  ),
  ranked as (
    select user_id,
      case c.metric_type
        when 'count_days'        then days::numeric
        when 'sum_duration_min'  then total_duration::numeric
        when 'sum_detail'        then detail_sum
        when 'sum_points'        then total_points::numeric
        when 'active_days'       then days::numeric
        else 0::numeric
      end as metric
    from scored
  )
  select user_id into w
  from ranked
  where metric > 0
  order by metric desc, user_id asc
  limit 1;

  update public.challenges
  set finalized_at = now(), winner_id = w
  where id = cid;

  if w is not null and c.reward_points > 0 then
    update public.profiles
    set total_points = total_points + c.reward_points
    where id = w;

    update public.group_members
    set group_points = group_points + c.reward_points
    where group_id = c.group_id and user_id = w;
  end if;
end;
$$;

-- Finalize every expired challenge in a group. Called when a group or
-- challenge page is viewed so awards are applied on first look past deadline.
create or replace function public.finalize_group_challenges(gid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id from public.challenges
    where group_id = gid
      and finalized_at is null
      and ends_at < current_date
  loop
    perform public.finalize_challenge(r.id);
  end loop;
end;
$$;
