-- ============================================================
-- 007_room_options.sql — Room options + curated player ordering
-- ============================================================
-- Adds:
--   • rooms.is_public     — discoverable in the public rooms list when true
--   • rooms.player_order  — 'RANDOM' | 'CATEGORY' auction ordering strategy
--   • seed_room_players() — builds the auction order; CATEGORY is a
--     "high-dopamine" weighted interleave that sprinkles star/medium players
--     through the sequence (top+medium drawn ~75%, low ~25%), randomised each
--     game so the order never repeats.
--
-- Idempotent — safe to run on an existing database.
-- ============================================================

-- 1. New columns ------------------------------------------------------------
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS player_order text NOT NULL DEFAULT 'RANDOM';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rooms_player_order_chk'
  ) THEN
    ALTER TABLE rooms
      ADD CONSTRAINT rooms_player_order_chk
      CHECK (player_order IN ('RANDOM', 'CATEGORY'));
  END IF;
END $$;

-- 2. Ordering builder -------------------------------------------------------
-- Returns the number of players inserted into room_players for the room.
CREATE OR REPLACE FUNCTION seed_room_players(p_room_id uuid, p_strategy text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  himed uuid[];        -- top + medium tier (rating >= 6), shuffled
  low   uuid[];        -- low tier (rating < 6), shuffled
  ordered uuid[] := '{}';
  n_h int; n_l int;
  i_h int := 1; i_l int := 1;
  v_count int;
BEGIN
  IF p_strategy = 'CATEGORY' THEN
    -- Tier split by rating, each shuffled so every game differs.
    SELECT array_agg(id ORDER BY random()) INTO himed
      FROM players WHERE COALESCE(rating, 0) >= 6;
    SELECT array_agg(id ORDER BY random()) INTO low
      FROM players WHERE COALESCE(rating, 0) < 6;

    n_h := COALESCE(array_length(himed, 1), 0);
    n_l := COALESCE(array_length(low, 1), 0);

    -- Weighted interleave: 75% of picks come from the top+medium pool, 25%
    -- from the low pool, until one runs out — then drain the other. This
    -- keeps exciting players sprinkled throughout instead of clustered.
    WHILE i_h <= n_h OR i_l <= n_l LOOP
      IF i_l > n_l THEN
        ordered := array_append(ordered, himed[i_h]); i_h := i_h + 1;
      ELSIF i_h > n_h THEN
        ordered := array_append(ordered, low[i_l]); i_l := i_l + 1;
      ELSIF random() < 0.75 THEN
        ordered := array_append(ordered, himed[i_h]); i_h := i_h + 1;
      ELSE
        ordered := array_append(ordered, low[i_l]); i_l := i_l + 1;
      END IF;
    END LOOP;

    INSERT INTO room_players (room_id, player_id, order_index)
    SELECT p_room_id, t.pid, t.ord
    FROM unnest(ordered) WITH ORDINALITY AS t(pid, ord);

    v_count := COALESCE(array_length(ordered, 1), 0);
  ELSE
    -- RANDOM: pure shuffle.
    INSERT INTO room_players (room_id, player_id, order_index)
    SELECT p_room_id, id, row_number() OVER (ORDER BY random())
    FROM players;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;

  RETURN v_count;
END;
$$;

-- 3. create_room — accept is_public + player_order --------------------------
-- Drop the old 5-arg signature so there is no overload ambiguity.
DROP FUNCTION IF EXISTS create_room(text, uuid, int, int, int);

CREATE OR REPLACE FUNCTION create_room(
  p_room_name text,
  p_admin_user_id uuid,
  p_purse_budget_lakhs int DEFAULT 12000,
  p_max_squad_size int DEFAULT 18,
  p_bid_timer_seconds int DEFAULT 30,
  p_is_public boolean DEFAULT true,
  p_player_order text DEFAULT 'RANDOM'
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_code varchar(6);
  v_room_id uuid;
  v_participant_id uuid;
  v_order text := CASE WHEN p_player_order = 'CATEGORY' THEN 'CATEGORY' ELSE 'RANDOM' END;
BEGIN
  LOOP
    v_room_code := upper(substr(md5(random()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE room_code = v_room_code);
  END LOOP;

  INSERT INTO rooms (room_code, room_name, admin_user_id, purse_budget_lakhs,
                     max_squad_size, bid_timer_seconds, is_public, player_order)
  VALUES (v_room_code, p_room_name, p_admin_user_id, p_purse_budget_lakhs,
          p_max_squad_size, p_bid_timer_seconds, p_is_public, v_order)
  RETURNING id INTO v_room_id;

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

-- 4. start_auction / start_auction_dev — use the chosen ordering ------------
CREATE OR REPLACE FUNCTION start_auction(
  p_room_id uuid,
  p_admin_user_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_room record;
  v_participant_count int;
  v_total_players int;
  v_first_rp_id uuid;
  v_timer_seconds int;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.admin_user_id != p_admin_user_id THEN RAISE EXCEPTION 'Only the room admin can start the auction'; END IF;
  IF v_room.status != 'LOBBY' THEN RAISE EXCEPTION 'Auction can only be started from lobby'; END IF;

  SELECT count(*) INTO v_participant_count FROM room_participants WHERE room_id = p_room_id;
  IF v_participant_count < 2 THEN RAISE EXCEPTION 'Need at least 2 participants to start'; END IF;

  v_timer_seconds := v_room.bid_timer_seconds;

  v_total_players := seed_room_players(p_room_id, COALESCE(v_room.player_order, 'RANDOM'));

  UPDATE rooms SET status = 'AUCTION', current_player_order_index = 1 WHERE id = p_room_id;

  UPDATE room_players
  SET status = 'ACTIVE', ends_at = now() + (v_timer_seconds || ' seconds')::interval
  WHERE room_id = p_room_id AND order_index = 1
  RETURNING id INTO v_first_rp_id;

  RETURN json_build_object('success', true, 'total_players', v_total_players, 'first_player_id', v_first_rp_id);
END;
$$;

CREATE OR REPLACE FUNCTION start_auction_dev(
  p_room_id uuid,
  p_admin_user_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- DEV: no minimum participant check.
  v_timer_seconds := v_room.bid_timer_seconds;

  v_total_players := seed_room_players(p_room_id, COALESCE(v_room.player_order, 'RANDOM'));

  UPDATE rooms SET status = 'AUCTION', current_player_order_index = 1 WHERE id = p_room_id;

  UPDATE room_players
  SET status = 'ACTIVE', ends_at = now() + (v_timer_seconds || ' seconds')::interval
  WHERE room_id = p_room_id AND order_index = 1
  RETURNING id INTO v_first_rp_id;

  RETURN json_build_object('success', true, 'total_players', v_total_players, 'first_player_id', v_first_rp_id);
END;
$$;
