-- ============================================================================
-- Migration: Create Tenants Table (2026-10-11)
-- Stores tenant profiles with bed assignments and Row Level Security.
-- Paste this script into: Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  bed_id uuid not null references public.beds(id) on delete cascade,
  full_name text not null,
  phone text not null,
  alt_contact_name text,
  alt_contact_relation text,
  alt_phone text,
  native_address text,
  id_type text,
  id_last4 text,
  gender text,
  occupation text,
  join_date date not null default current_date,
  leave_date date,
  status text not null default 'active' check (status in ('active', 'notice', 'left')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Unique constraint: A bed can only have ONE live (active or notice) tenant at a time.
-- This prevents accidental double-booking at the database level.
create unique index if not exists unique_active_tenant_per_bed
  on public.tenants (bed_id)
  where status in ('active', 'notice');

-- Automatic updated_at trigger
drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- Enable Row Level Security (RLS)
alter table public.tenants enable row level security;

-- Policies: Owners can only manage their own tenants
create policy "Owners can view their own tenants"
  on public.tenants for select using (auth.uid() = owner_id);

create policy "Owners can create tenants"
  on public.tenants for insert with check (auth.uid() = owner_id);

create policy "Owners can update their own tenants"
  on public.tenants for update using (auth.uid() = owner_id);

create policy "Owners can delete their own tenants"
  on public.tenants for delete using (auth.uid() = owner_id);
