-- ============================================================
-- 003_functions.sql – SECURITY DEFINER RPC functions
-- ============================================================

-- -----------------------------------------------
-- 1. create_room
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION create_room(
  p_room_name text,
  p_admin_user_id uuid,
  p_purse_budget_lakhs int DEFAULT 12000,
  p_max_squad_size int DEFAULT 18,
  p_bid_timer_seconds int DEFAULT 30
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_code varchar(6);
  v_room_id uuid;
  v_participant_id uuid;
BEGIN
  -- Generate unique room code
  LOOP
    v_room_code := upper(substr(md5(random()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE room_code = v_room_code);
  END LOOP;

  -- Insert room
  INSERT INTO rooms (room_code, room_name, admin_user_id, purse_budget_lakhs, max_squad_size, bid_timer_seconds)
  VALUES (v_room_code, p_room_name, p_admin_user_id, p_purse_budget_lakhs, p_max_squad_size, p_bid_timer_seconds)
  RETURNING id INTO v_room_id;

  -- Auto-join admin as first participant
  INSERT INTO room_participants (room_id, user_id, display_name, squad_name, remaining_budget_lakhs)
  VALUES (v_room_id, p_admin_user_id, 'Admin', 'Team ' || v_room_code, p_purse_budget_lakhs)
  RETURNING id INTO v_participant_id;

  RETURN json_build_object(
    'id', v_room_id,
    'room_code', v_room_code,
    'room_name', p_room_name,
    'participant_id', v_participant_id
  );
END;
$$;

-- -----------------------------------------------
-- 2. join_room
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION join_room(
  p_room_code text,
  p_user_id uuid,
  p_display_name text,
  p_squad_name text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_participant_count int;
  v_participant_id uuid;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE room_code = upper(p_room_code);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.status != 'LOBBY' THEN
    RAISE EXCEPTION 'Room is not accepting new participants';
  END IF;

  SELECT count(*) INTO v_participant_count FROM room_participants WHERE room_id = v_room.id;
  IF v_participant_count >= 5 THEN
    RAISE EXCEPTION 'Room is full (max 5 participants)';
  END IF;

  IF EXISTS (SELECT 1 FROM room_participants WHERE room_id = v_room.id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'You have already joined this room';
  END IF;

  INSERT INTO room_participants (room_id, user_id, display_name, squad_name, remaining_budget_lakhs)
  VALUES (v_room.id, p_user_id, p_display_name, p_squad_name, v_room.purse_budget_lakhs)
  RETURNING id INTO v_participant_id;

  RETURN json_build_object(
    'id', v_participant_id,
    'room_id', v_room.id,
    'user_id', p_user_id,
    'display_name', p_display_name,
    'squad_name', p_squad_name,
    'remaining_budget_lakhs', v_room.purse_budget_lakhs
  );
END;
$$;

-- -----------------------------------------------
-- 3. start_auction
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION start_auction(
  p_room_id uuid,
  p_admin_user_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_participant_count int;
  v_total_players int;
  v_first_rp_id uuid;
  v_timer_seconds int;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.admin_user_id != p_admin_user_id THEN
    RAISE EXCEPTION 'Only the room admin can start the auction';
  END IF;

  IF v_room.status != 'LOBBY' THEN
    RAISE EXCEPTION 'Auction can only be started from lobby';
  END IF;

  SELECT count(*) INTO v_participant_count FROM room_participants WHERE room_id = p_room_id;
  IF v_participant_count < 2 THEN
    RAISE EXCEPTION 'Need at least 2 participants to start';
  END IF;

  v_timer_seconds := v_room.bid_timer_seconds;

  -- Insert all players with randomized order
  INSERT INTO room_players (room_id, player_id, order_index)
  SELECT p_room_id, id, row_number() OVER (ORDER BY random())
  FROM players;

  GET DIAGNOSTICS v_total_players = ROW_COUNT;

  -- Update room status
  UPDATE rooms SET status = 'AUCTION', current_player_order_index = 1 WHERE id = p_room_id;

  -- Activate first player
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

-- -----------------------------------------------
-- 4. place_bid
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION place_bid(
  p_room_player_id uuid,
  p_participant_id uuid,
  p_amount_lakhs int
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rp record;
  v_room record;
  v_participant record;
  v_current_highest int;
  v_base_price int;
  v_won_count int;
  v_bid_id uuid;
BEGIN
  -- Lock the room_player row
  SELECT * INTO v_rp FROM room_players WHERE id = p_room_player_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Player not found in auction';
  END IF;

  IF v_rp.status != 'ACTIVE' THEN
    RAISE EXCEPTION 'This player is not currently up for auction';
  END IF;

  IF v_rp.ends_at IS NOT NULL AND v_rp.ends_at <= now() THEN
    RAISE EXCEPTION 'Bidding time has expired';
  END IF;

  -- Get base price
  SELECT base_price_lakhs INTO v_base_price FROM players WHERE id = v_rp.player_id;

  -- Get current highest bid
  SELECT max(amount_lakhs) INTO v_current_highest FROM bids WHERE room_player_id = p_room_player_id;

  -- Validate bid amount
  IF v_current_highest IS NULL THEN
    IF p_amount_lakhs < v_base_price THEN
      RAISE EXCEPTION 'Bid must be at least the base price (%s lakhs)', v_base_price;
    END IF;
  ELSE
    IF p_amount_lakhs <= v_current_highest THEN
      RAISE EXCEPTION 'Bid must be higher than current highest bid (%s lakhs)', v_current_highest;
    END IF;
  END IF;

  -- Lock and validate participant
  SELECT * INTO v_participant FROM room_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Participant not found';
  END IF;

  IF v_participant.remaining_budget_lakhs < p_amount_lakhs THEN
    RAISE EXCEPTION 'Insufficient budget. Available: %s lakhs', v_participant.remaining_budget_lakhs;
  END IF;

  -- Get room for max_squad_size check
  SELECT * INTO v_room FROM rooms WHERE id = v_rp.room_id;

  -- Check squad size
  SELECT count(*) INTO v_won_count
  FROM room_players
  WHERE room_id = v_rp.room_id
    AND winning_participant_id = p_participant_id
    AND status = 'SOLD';

  IF v_won_count >= v_room.max_squad_size THEN
    RAISE EXCEPTION 'Squad is full (%s/%s players)', v_won_count, v_room.max_squad_size;
  END IF;

  -- Insert bid
  INSERT INTO bids (room_id, room_player_id, participant_id, amount_lakhs)
  VALUES (v_rp.room_id, p_room_player_id, p_participant_id, p_amount_lakhs)
  RETURNING id INTO v_bid_id;

  -- Extend timer if less than 10 seconds remain
  UPDATE room_players
  SET ends_at = GREATEST(ends_at, now() + interval '10 seconds')
  WHERE id = p_room_player_id;

  RETURN json_build_object(
    'id', v_bid_id,
    'amount_lakhs', p_amount_lakhs,
    'participant_id', p_participant_id
  );
END;
$$;

-- -----------------------------------------------
-- 5. advance_to_next_player (helper)
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION advance_to_next_player(
  p_room_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_rp record;
  v_timer_seconds int;
BEGIN
  SELECT bid_timer_seconds INTO v_timer_seconds FROM rooms WHERE id = p_room_id;

  SELECT * INTO v_next_rp
  FROM room_players
  WHERE room_id = p_room_id AND status = 'PENDING'
  ORDER BY order_index ASC
  LIMIT 1;

  IF FOUND THEN
    UPDATE room_players
    SET status = 'ACTIVE', ends_at = now() + (v_timer_seconds || ' seconds')::interval
    WHERE id = v_next_rp.id;

    UPDATE rooms SET current_player_order_index = v_next_rp.order_index WHERE id = p_room_id;
  ELSE
    UPDATE rooms SET status = 'COMPLETED' WHERE id = p_room_id;
  END IF;
END;
$$;

-- -----------------------------------------------
-- 6. resolve_expired_auctions
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION resolve_expired_auctions() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rp record;
  v_highest_bid record;
BEGIN
  FOR v_rp IN
    SELECT * FROM room_players
    WHERE status = 'ACTIVE' AND ends_at IS NOT NULL AND ends_at <= now()
    FOR UPDATE
  LOOP
    -- Find highest bid
    SELECT * INTO v_highest_bid
    FROM bids
    WHERE room_player_id = v_rp.id
    ORDER BY amount_lakhs DESC, created_at ASC
    LIMIT 1;

    IF FOUND THEN
      -- Mark as SOLD
      UPDATE room_players
      SET status = 'SOLD',
          winning_participant_id = v_highest_bid.participant_id,
          sold_price_lakhs = v_highest_bid.amount_lakhs
      WHERE id = v_rp.id;

      -- Deduct from winner's budget
      UPDATE room_participants
      SET remaining_budget_lakhs = remaining_budget_lakhs - v_highest_bid.amount_lakhs
      WHERE id = v_highest_bid.participant_id;
    ELSE
      -- Mark as UNSOLD
      UPDATE room_players SET status = 'UNSOLD' WHERE id = v_rp.id;
    END IF;

    -- Advance to next player
    PERFORM advance_to_next_player(v_rp.room_id);
  END LOOP;
END;
$$;

-- -----------------------------------------------
-- 7. check_and_resolve
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION check_and_resolve(
  p_room_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rp record;
  v_highest_bid record;
  v_room record;
  v_active_player json;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  -- Find active player
  SELECT * INTO v_rp FROM room_players
  WHERE room_id = p_room_id AND status = 'ACTIVE'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'status', v_room.status,
      'active_player', NULL,
      'resolved', false
    );
  END IF;

  -- Check if expired
  IF v_rp.ends_at IS NOT NULL AND v_rp.ends_at <= now() THEN
    -- Resolve
    SELECT * INTO v_highest_bid
    FROM bids WHERE room_player_id = v_rp.id
    ORDER BY amount_lakhs DESC, created_at ASC
    LIMIT 1;

    IF FOUND THEN
      UPDATE room_players
      SET status = 'SOLD',
          winning_participant_id = v_highest_bid.participant_id,
          sold_price_lakhs = v_highest_bid.amount_lakhs
      WHERE id = v_rp.id;

      UPDATE room_participants
      SET remaining_budget_lakhs = remaining_budget_lakhs - v_highest_bid.amount_lakhs
      WHERE id = v_highest_bid.participant_id;
    ELSE
      UPDATE room_players SET status = 'UNSOLD' WHERE id = v_rp.id;
    END IF;

    PERFORM advance_to_next_player(p_room_id);

    -- Refresh room status
    SELECT * INTO v_room FROM rooms WHERE id = p_room_id;

    RETURN json_build_object(
      'status', v_room.status,
      'resolved', true,
      'result', CASE WHEN v_highest_bid IS NOT NULL THEN 'SOLD' ELSE 'UNSOLD' END
    );
  END IF;

  -- Not expired yet
  RETURN json_build_object(
    'status', v_room.status,
    'active_player_id', v_rp.id,
    'ends_at', v_rp.ends_at,
    'resolved', false
  );
END;
$$;

-- -----------------------------------------------
-- 8. pause_auction
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION pause_auction(
  p_room_id uuid,
  p_admin_user_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_rp record;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.admin_user_id != p_admin_user_id THEN RAISE EXCEPTION 'Only admin can pause'; END IF;
  IF v_room.status != 'AUCTION' THEN RAISE EXCEPTION 'Can only pause during auction'; END IF;

  SELECT * INTO v_rp FROM room_players WHERE room_id = p_room_id AND status = 'ACTIVE';
  IF FOUND THEN
    UPDATE room_players
    SET remaining_seconds_on_pause = GREATEST(0, EXTRACT(EPOCH FROM (ends_at - now()))::int),
        ends_at = NULL
    WHERE id = v_rp.id;
  END IF;

  UPDATE rooms SET status = 'PAUSED' WHERE id = p_room_id;

  RETURN json_build_object('success', true, 'status', 'PAUSED');
END;
$$;

-- -----------------------------------------------
-- 9. resume_auction
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION resume_auction(
  p_room_id uuid,
  p_admin_user_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_rp record;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.admin_user_id != p_admin_user_id THEN RAISE EXCEPTION 'Only admin can resume'; END IF;
  IF v_room.status != 'PAUSED' THEN RAISE EXCEPTION 'Can only resume a paused auction'; END IF;

  SELECT * INTO v_rp FROM room_players WHERE room_id = p_room_id AND status = 'ACTIVE';
  IF FOUND THEN
    UPDATE room_players
    SET ends_at = now() + (COALESCE(remaining_seconds_on_pause, v_room.bid_timer_seconds) || ' seconds')::interval,
        remaining_seconds_on_pause = NULL
    WHERE id = v_rp.id;
  END IF;

  UPDATE rooms SET status = 'AUCTION' WHERE id = p_room_id;

  RETURN json_build_object('success', true, 'status', 'AUCTION');
END;
$$;

-- -----------------------------------------------
-- 10. force_resolve_current_player
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION force_resolve_current_player(
  p_room_id uuid,
  p_admin_user_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_rp record;
  v_highest_bid record;
  v_result text;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.admin_user_id != p_admin_user_id THEN RAISE EXCEPTION 'Only admin can force resolve'; END IF;

  SELECT * INTO v_rp FROM room_players
  WHERE room_id = p_room_id AND status = 'ACTIVE'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active player to resolve'; END IF;

  SELECT * INTO v_highest_bid
  FROM bids WHERE room_player_id = v_rp.id
  ORDER BY amount_lakhs DESC, created_at ASC
  LIMIT 1;

  IF FOUND THEN
    UPDATE room_players
    SET status = 'SOLD',
        winning_participant_id = v_highest_bid.participant_id,
        sold_price_lakhs = v_highest_bid.amount_lakhs,
        ends_at = now()
    WHERE id = v_rp.id;

    UPDATE room_participants
    SET remaining_budget_lakhs = remaining_budget_lakhs - v_highest_bid.amount_lakhs
    WHERE id = v_highest_bid.participant_id;

    v_result := 'SOLD';
  ELSE
    UPDATE room_players SET status = 'UNSOLD', ends_at = now() WHERE id = v_rp.id;
    v_result := 'UNSOLD';
  END IF;

  PERFORM advance_to_next_player(p_room_id);

  RETURN json_build_object('success', true, 'result', v_result);
END;
$$;

-- -----------------------------------------------
-- 11. end_auction_early
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION end_auction_early(
  p_room_id uuid,
  p_admin_user_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_affected int;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.admin_user_id != p_admin_user_id THEN RAISE EXCEPTION 'Only admin can end auction'; END IF;

  UPDATE room_players
  SET status = 'UNSOLD', ends_at = NULL
  WHERE room_id = p_room_id AND status IN ('PENDING', 'ACTIVE');
  GET DIAGNOSTICS v_affected = ROW_COUNT;

  UPDATE rooms SET status = 'COMPLETED' WHERE id = p_room_id;

  RETURN json_build_object('success', true, 'unsold_count', v_affected);
END;
$$;
