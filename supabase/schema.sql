-- ============================================================================
-- PGDesk Database Schema + Row Level Security (Phase A2)
-- Paste the entire contents of this file into:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste -> Run
-- ============================================================================

-- PLAIN-ENGLISH EXPLANATION OF SECURITY & DATA RULES:
-- 1. True Multi-Tenancy:
--    Every table has an "owner_id" column storing the logged-in owner's user ID.
--    Row Level Security (RLS) is enabled on every single table.
--    Postgres enforces at the database level that you can ONLY see, add, edit,
--    or delete rows where owner_id = auth.uid() (your own user ID).
--    Even child tables (floors, rooms, beds) carry their own owner_id for double protection.
--
-- 2. Clean UUIDs:
--    All table IDs use native UUIDs (crypto.randomUUID() / gen_random_uuid()).
--
-- 3. Automatic Timestamps:
--    The database sets created_at and updated_at automatically.
--    A trigger automatically refreshes updated_at on every update, so the app
--    never relies on the browser's device clock.
-- ============================================================================

-- If upgrading from an earlier draft schema where id columns were text,
-- drop old tables first so they recreate with clean UUID types:
drop table if exists public.beds cascade;
drop table if exists public.rooms cascade;
drop table if exists public.floors cascade;
drop table if exists public.pgs cascade;

-- ============================================================
-- 1. HELPER: Automatic updated_at trigger function
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 2. PROFILES TABLE
-- Stores owner name, mobile number, and email.
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text,
  mobile text,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger: auto-create a profile row when a new user signs up via Google
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, owner_id, full_name, email, created_at, updated_at)
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.email,
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- 3. PGS TABLE (Properties)
-- One row per PG property.
-- ============================================================
create table public.pgs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  logo_url text,
  contact_phone text not null,
  address text not null,
  city text not null default 'Bengaluru',
  pincode text not null,
  type text not null default 'coliving' check (type in ('boys', 'girls', 'coliving')),
  rules jsonb not null default '{}',
  facilities text[] not null default '{}',
  pricing jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists pgs_set_updated_at on public.pgs;
create trigger pgs_set_updated_at
  before update on public.pgs
  for each row execute function public.set_updated_at();

-- ============================================================
-- 4. FLOORS TABLE
-- One row per floor/block of a PG.
-- ============================================================
create table public.floors (
  id uuid primary key default gen_random_uuid(),
  pg_id uuid not null references public.pgs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  "order" integer not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists floors_set_updated_at on public.floors;
create trigger floors_set_updated_at
  before update on public.floors
  for each row execute function public.set_updated_at();

-- ============================================================
-- 5. ROOMS TABLE
-- One row per room.
-- ============================================================
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  pg_id uuid not null references public.pgs(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sharing_type integer not null default 2 check (sharing_type between 1 and 8),
  is_ac boolean not null default false,
  has_attached_bathroom boolean not null default true,
  amenities text[] not null default '{}',
  custom_rent numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- ============================================================
-- 6. BEDS TABLE
-- One row per bed.
-- ============================================================
create table public.beds (
  id uuid primary key default gen_random_uuid(),
  pg_id uuid not null references public.pgs(id) on delete cascade,
  floor_id uuid not null references public.floors(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'vacant' check (status in ('vacant','occupied','notice','reserved','maintenance')),
  custom_rent numeric,
  tenant_name text,
  tenant_phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists beds_set_updated_at on public.beds;
create trigger beds_set_updated_at
  before update on public.beds
  for each row execute function public.set_updated_at();

-- ============================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- PROFILES
alter table public.profiles enable row level security;
create policy "Owners can view their own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Owners can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);
create policy "Owners can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- PGS
alter table public.pgs enable row level security;
create policy "Owners can view their own PGs"
  on public.pgs for select using (auth.uid() = owner_id);
create policy "Owners can create PGs"
  on public.pgs for insert with check (auth.uid() = owner_id);
create policy "Owners can update their own PGs"
  on public.pgs for update using (auth.uid() = owner_id);
create policy "Owners can delete their own PGs"
  on public.pgs for delete using (auth.uid() = owner_id);

-- FLOORS
alter table public.floors enable row level security;
create policy "Owners can view their own floors"
  on public.floors for select using (auth.uid() = owner_id);
create policy "Owners can create floors"
  on public.floors for insert with check (auth.uid() = owner_id);
create policy "Owners can update their own floors"
  on public.floors for update using (auth.uid() = owner_id);
create policy "Owners can delete their own floors"
  on public.floors for delete using (auth.uid() = owner_id);

-- ROOMS
alter table public.rooms enable row level security;
create policy "Owners can view their own rooms"
  on public.rooms for select using (auth.uid() = owner_id);
create policy "Owners can create rooms"
  on public.rooms for insert with check (auth.uid() = owner_id);
create policy "Owners can update their own rooms"
  on public.rooms for update using (auth.uid() = owner_id);
create policy "Owners can delete their own rooms"
  on public.rooms for delete using (auth.uid() = owner_id);

-- BEDS
alter table public.beds enable row level security;
create policy "Owners can view their own beds"
  on public.beds for select using (auth.uid() = owner_id);
create policy "Owners can create beds"
  on public.beds for insert with check (auth.uid() = owner_id);
create policy "Owners can update their own beds"
  on public.beds for update using (auth.uid() = owner_id);
create policy "Owners can delete their own beds"
  on public.beds for delete using (auth.uid() = owner_id);

-- Setup complete!
