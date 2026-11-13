-- ============================================================================
-- Migration: Tenant Login via QR Invite & Tenant Portal
-- Date: 2026-10-11
-- Description:
--   1. Adds user_id and consent_at columns to public.tenants
--   2. Creates public.tenant_invites table for secure one-time invite tokens
--   3. RPC create_tenant_invite(p_tenant_id): creates secret token, returns once
--   4. RPC reset_tenant_access(p_tenant_id): revokes invites & unbinds user_id
--   5. RPC preview_invite(p_token): returns public info for join page confirmation
--   6. RPC claim_invite(p_token): binds invite token to signed-in auth.uid()
--   7. RPC get_my_stays(): returns JSON array of signed-in tenant's stays
-- ============================================================================

-- 1. Ensure user_id and consent_at exist on public.tenants
alter table public.tenants
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists consent_at timestamptz;

-- 2. Create tenant_invites table
create table if not exists public.tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'claimed', 'expired', 'revoked')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  claimed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on tenant_invites
alter table public.tenant_invites enable row level security;

-- Owners can view their own tenant invites
create policy "Owners can view their tenant invites"
  on public.tenant_invites for select
  using (auth.uid() = owner_id);

-- Owners can delete their tenant invites
create policy "Owners can delete their tenant invites"
  on public.tenant_invites for delete
  using (auth.uid() = owner_id);

-- 3. RPC: create_tenant_invite
create or replace function public.create_tenant_invite(p_tenant_id uuid)
returns text language plpgsql security definer as $$
declare
  v_owner_id uuid;
  v_token text;
begin
  -- Verify caller is the owner of this tenant
  select owner_id into v_owner_id
  from public.tenants
  where id = p_tenant_id;

  if v_owner_id is null or v_owner_id <> auth.uid() then
    raise exception 'Permission denied or tenant not found';
  end if;

  -- Revoke any existing pending invites for this tenant
  update public.tenant_invites
  set status = 'revoked', updated_at = now()
  where tenant_id = p_tenant_id and status = 'pending';

  -- Generate secure random token (URL-safe hex string)
  v_token := encode(gen_random_bytes(24), 'hex');

  -- Insert new invite valid for 7 days
  insert into public.tenant_invites (
    tenant_id,
    owner_id,
    token,
    status,
    expires_at
  ) values (
    p_tenant_id,
    v_owner_id,
    v_token,
    'pending',
    now() + interval '7 days'
  );

  return v_token;
end;
$$;

-- 4. RPC: reset_tenant_access
create or replace function public.reset_tenant_access(p_tenant_id uuid)
returns void language plpgsql security definer as $$
declare
  v_owner_id uuid;
begin
  select owner_id into v_owner_id
  from public.tenants
  where id = p_tenant_id;

  if v_owner_id is null or v_owner_id <> auth.uid() then
    raise exception 'Permission denied or tenant not found';
  end if;

  -- Revoke all invites
  update public.tenant_invites
  set status = 'revoked', updated_at = now()
  where tenant_id = p_tenant_id and status in ('pending', 'claimed');

  -- Disconnect tenant user_id and consent
  update public.tenants
  set user_id = null, consent_at = null, updated_at = now()
  where id = p_tenant_id;
end;
$$;

-- 5. RPC: preview_invite
create or replace function public.preview_invite(p_token text)
returns jsonb language plpgsql security definer as $$
declare
  v_invite record;
  v_tenant record;
  v_bed record;
  v_room record;
  v_pg record;
begin
  -- Fetch invite
  select * into v_invite
  from public.tenant_invites
  where token = p_token;

  if not found then
    raise exception 'This invite link is invalid. Please ask your PG owner for a new invite.';
  end if;

  if v_invite.status = 'claimed' then
    raise exception 'This invite has already been claimed.';
  end if;

  if v_invite.status = 'revoked' then
    raise exception 'This invite has been cancelled by the PG owner. Please ask for a new invite.';
  end if;

  if v_invite.expires_at < now() or v_invite.status = 'expired' then
    update public.tenant_invites set status = 'expired' where id = v_invite.id;
    raise exception 'This invite link has expired. Please ask your PG owner for a new invite.';
  end if;

  -- Fetch tenant details
  select * into v_tenant from public.tenants where id = v_invite.tenant_id;
  if not found then
    raise exception 'Tenant record not found.';
  end if;

  -- Fetch bed, room, pg
  select * into v_bed from public.beds where id = v_tenant.bed_id;
  select * into v_room from public.rooms where id = v_bed.room_id;
  select * into v_pg from public.pgs where id = v_tenant.pg_id;

  return jsonb_build_object(
    'tenant_name', v_tenant.full_name,
    'pg_name', coalesce(v_pg.name, 'PG Property'),
    'room', coalesce(v_room.name, 'Room'),
    'bed', coalesce(v_bed.name, 'Bed')
  );
end;
$$;

-- 6. RPC: claim_invite
create or replace function public.claim_invite(p_token text)
returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_invite record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'You must be signed in to claim this invite.';
  end if;

  -- Lock and fetch invite
  select * into v_invite
  from public.tenant_invites
  where token = p_token
  for update;

  if not found then
    raise exception 'This invite link is invalid. Please ask your PG owner for a new invite.';
  end if;

  if v_invite.status = 'claimed' then
    raise exception 'This invite has already been claimed.';
  end if;

  if v_invite.status = 'revoked' then
    raise exception 'This invite has been cancelled. Please ask your PG owner for a new invite.';
  end if;

  if v_invite.expires_at < now() or v_invite.status = 'expired' then
    update public.tenant_invites set status = 'expired' where id = v_invite.id;
    raise exception 'This invite link has expired. Please ask your PG owner for a new invite.';
  end if;

  -- Bind tenant record to this user
  update public.tenants
  set
    user_id = v_user_id,
    consent_at = now(),
    updated_at = now()
  where id = v_invite.tenant_id;

  -- Mark invite as claimed
  update public.tenant_invites
  set
    status = 'claimed',
    claimed_at = now(),
    claimed_by = v_user_id,
    updated_at = now()
  where id = v_invite.id;

  return jsonb_build_object('success', true);
end;
$$;

-- 7. RPC: get_my_stays
create or replace function public.get_my_stays()
returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_result jsonb;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(stay_item order by (stay_item->'stay'->>'join_date') desc), '[]'::jsonb)
  into v_result
  from (
    select
      jsonb_build_object(
        'tenant', jsonb_build_object(
          'id', t.id,
          'full_name', t.full_name,
          'phone', t.phone,
          'alt_contact_name', t.alt_contact_name,
          'alt_contact_relation', t.alt_contact_relation,
          'alt_phone', t.alt_phone,
          'native_address', t.native_address,
          'id_type', t.id_type,
          'id_last4', t.id_last4,
          'occupation', t.occupation,
          'status', t.status
        ),
        'stay', jsonb_build_object(
          'room_name', r.name,
          'bed_name', b.name,
          'floor_name', f.name,
          'is_ac', r.is_ac,
          'has_attached_bathroom', r.has_attached_bathroom,
          'join_date', t.join_date,
          'leave_date', t.leave_date,
          'rent', coalesce(b.custom_rent, r.custom_rent, ((p.pricing->'roomTypeRent')->>(r.sharing_type::text))::numeric, 0),
          'deposit', coalesce((p.pricing->>'deposit')::numeric, 0),
          'maintenance', coalesce((p.pricing->>'maintenance')::numeric, 0),
          'food_included', coalesce((p.pricing->>'foodIncluded')::boolean, false)
        ),
        'pg', jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'contact_phone', p.contact_phone,
          'address', p.address,
          'city', p.city,
          'pincode', p.pincode,
          'type', p.type,
          'gate_timing', coalesce(p.rules->>'gateTiming', ''),
          'visitor_policy', coalesce(p.rules->>'visitorPolicy', ''),
          'other_rules', coalesce(p.rules->>'otherRules', ''),
          'facilities', coalesce(p.facilities, array[]::text[])
        )
      ) as stay_item
    from public.tenants t
    join public.beds b on b.id = t.bed_id
    join public.rooms r on r.id = b.room_id
    join public.floors f on f.id = r.floor_id
    join public.pgs p on p.id = t.pg_id
    where t.user_id = v_user_id
      and t.status in ('active', 'notice', 'reserved')
  ) sub;

  return v_result;
end;
$$;

-- Grant execute to authenticated users (and anon for preview_invite)
grant execute on function public.create_tenant_invite(uuid) to authenticated;
grant execute on function public.reset_tenant_access(uuid) to authenticated;
grant execute on function public.preview_invite(text) to anon, authenticated;
grant execute on function public.claim_invite(text) to authenticated;
grant execute on function public.get_my_stays() to authenticated;
