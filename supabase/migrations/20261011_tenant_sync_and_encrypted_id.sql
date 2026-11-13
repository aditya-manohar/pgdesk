-- ============================================================================
-- Migration: Automatic Bed Status Sync, pg_id auto-population, and Encrypted ID Storage
-- Date: 2026-10-11
-- Description:
--   1. Auto-populates pg_id on public.tenants from public.beds if not provided.
--   2. Automatically synchronizes public.beds.status on insert/update of tenant status:
--      - active   -> occupied
--      - reserved -> reserved
--      - notice   -> notice
--      - left     -> vacant
--   3. Adds secure RPCs:
--      - set_tenant_id_number: stores encrypted full ID number and extracts id_last4
--      - reveal_tenant_id_number: decrypts and returns full ID number for the tenant's owner
-- ============================================================================

-- Ensure pgcrypto extension is enabled for symmetric encryption
create extension if not exists pgcrypto;

-- 1. Ensure pg_id column exists on public.tenants
alter table public.tenants
  add column if not exists pg_id text references public.pgs(id) on delete cascade;

-- Trigger function: auto-fill pg_id from beds if omitted
create or replace function public.set_tenant_pg_id()
returns trigger language plpgsql security definer as $$
begin
  if new.pg_id is null then
    select pg_id into new.pg_id from public.beds where id = new.bed_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_set_tenant_pg_id on public.tenants;
create trigger trigger_set_tenant_pg_id
  before insert on public.tenants
  for each row execute function public.set_tenant_pg_id();

-- 2. Update status constraint on tenants to allow 'reserved'
alter table public.tenants
  drop constraint if exists tenants_status_check;

alter table public.tenants
  add constraint tenants_status_check
  check (status in ('active', 'notice', 'reserved', 'left'));

-- Update unique partial index to ensure only 1 active/notice/reserved tenant per bed
drop index if exists unique_active_tenant_per_bed;
create unique index if not exists unique_active_tenant_per_bed
  on public.tenants (bed_id)
  where status in ('active', 'notice', 'reserved');

-- 3. Automatic bed status synchronization trigger
create or replace function public.sync_bed_status_from_tenant()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'active' then
    update public.beds set status = 'occupied', updated_at = now() where id = new.bed_id;
  elsif new.status = 'reserved' then
    update public.beds set status = 'reserved', updated_at = now() where id = new.bed_id;
  elsif new.status = 'notice' then
    update public.beds set status = 'notice', updated_at = now() where id = new.bed_id;
  elsif new.status = 'left' then
    update public.beds set status = 'vacant', updated_at = now() where id = new.bed_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_sync_bed_status_from_tenant on public.tenants;
create trigger trigger_sync_bed_status_from_tenant
  after insert or update of status on public.tenants
  for each row execute function public.sync_bed_status_from_tenant();

-- 4. Encrypted ID number storage
alter table public.tenants
  add column if not exists encrypted_id_number text;

-- RPC: set_tenant_id_number
create or replace function public.set_tenant_id_number(
  p_tenant_id uuid,
  p_number text
)
returns void language plpgsql security definer as $$
declare
  v_owner_id uuid;
begin
  -- Enforce that caller is the owner
  select owner_id into v_owner_id from public.tenants where id = p_tenant_id;
  if v_owner_id is null or v_owner_id <> auth.uid() then
    raise exception 'Permission denied for function set_tenant_id_number';
  end if;

  update public.tenants
  set
    encrypted_id_number = case
      when p_number is null or trim(p_number) = '' then null
      else encode(pgp_sym_encrypt(trim(p_number), 'pgdesk_tenant_secret_id_key_v1'), 'hex')
    end,
    id_last4 = case
      when p_number is null or trim(p_number) = '' then null
      else right(regexp_replace(trim(p_number), '\s+', '', 'g'), 4)
    end,
    updated_at = now()
  where id = p_tenant_id and owner_id = auth.uid();
end;
$$;

-- RPC: reveal_tenant_id_number
create or replace function public.reveal_tenant_id_number(
  p_tenant_id uuid
)
returns text language plpgsql security definer as $$
declare
  v_encrypted text;
  v_owner_id uuid;
begin
  -- Enforce that caller is the owner
  select owner_id, encrypted_id_number
  into v_owner_id, v_encrypted
  from public.tenants
  where id = p_tenant_id;

  if v_owner_id is null or v_owner_id <> auth.uid() then
    raise exception 'Permission denied for function reveal_tenant_id_number';
  end if;

  if v_encrypted is null then
    return null;
  end if;

  return pgp_sym_decrypt(decode(v_encrypted, 'hex'), 'pgdesk_tenant_secret_id_key_v1');
exception
  when others then
    return null;
end;
$$;

-- Grant execute permissions to authenticated owners
grant execute on function public.set_tenant_id_number(uuid, text) to authenticated;
grant execute on function public.reveal_tenant_id_number(uuid) to authenticated;
