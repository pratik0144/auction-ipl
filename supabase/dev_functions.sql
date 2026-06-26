-- ==========================================================================
-- DEV MODE FUNCTION — Run this in the Supabase SQL Editor
-- Allows starting an auction with just 1 participant (for solo testing)
-- ==========================================================================

CREATE OR REPLACE FUNCTION start_auction_dev(
  p_room_id uuid,
  p_admin_user_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_total_players int;
  v_first_rp_id uuid;
  v_timer_seconds int;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.admin_user_id != p_admin_user_id THEN RAISE EXCEPTION 'Only the room admin can start the auction'; END IF;
  IF v_room.status != 'LOBBY' THEN RAISE EXCEPTION 'Auction can only be started from lobby'; END IF;

  -- DEV: No minimum participant check!

  v_timer_seconds := v_room.bid_timer_seconds;

  -- Uses the room's chosen ordering strategy (see seed_room_players).
  v_total_players := seed_room_players(p_room_id, COALESCE(v_room.player_order, 'RANDOM'));

  UPDATE rooms SET status = 'AUCTION', current_player_order_index = 1 WHERE id = p_room_id;

  UPDATE room_players
  SET status = 'ACTIVE', ends_at = now() + (v_timer_seconds || ' seconds')::interval
  WHERE room_id = p_room_id AND order_index = 1
  RETURNING id INTO v_first_rp_id;

  RETURN json_build_object(
    'success', true,
    'total_players', v_total_players,
    'first_player_id', v_first_rp_id
  );
END;
$$;
