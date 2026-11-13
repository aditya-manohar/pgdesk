-- ============================================================================
-- Migration: Move Room To Floor Function
-- Date: 2026-10-11
-- Description:
--   Creates the move_room_to_floor RPC function to safely move a room and its
--   associated beds to a new floor belonging to the same PG and owner.
-- ============================================================================

create or replace function public.move_room_to_floor(
  p_room_id text,
  p_floor_id text
)
returns void language plpgsql security definer as $$
declare
  v_room_pg_id text;
  v_room_owner_id uuid;
  v_target_pg_id text;
  v_target_owner_id uuid;
begin
  -- 1. Fetch current room details
  select pg_id, owner_id
  into v_room_pg_id, v_room_owner_id
  from public.rooms
  where id = p_room_id;

  if not found then
    raise exception 'Room not found with ID %', p_room_id;
  end if;

  -- 2. Security: Ensure caller owns the room
  if v_room_owner_id <> auth.uid() then
    raise exception 'Unauthorized: You do not own this room';
  end if;

  -- 3. Fetch target floor details
  select pg_id, owner_id
  into v_target_pg_id, v_target_owner_id
  from public.floors
  where id = p_floor_id;

  if not found then
    raise exception 'Target floor not found with ID %', p_floor_id;
  end if;

  -- 4. Safety: Verify target floor belongs to the same owner and same PG
  if v_target_owner_id <> auth.uid() then
    raise exception 'Unauthorized: Target floor belongs to another owner';
  end if;

  if v_target_pg_id <> v_room_pg_id then
    raise exception 'Cannot move room to a floor in a different PG';
  end if;

  -- 5. Update room's floor_id
  update public.rooms
  set floor_id = p_floor_id
  where id = p_room_id;

  -- 6. Update floor_id on all child beds belonging to this room
  update public.beds
  set floor_id = p_floor_id
  where room_id = p_room_id;

end;
$$;

-- Grant execution permission to authenticated users
grant execute on function public.move_room_to_floor(text, text) to authenticated;
