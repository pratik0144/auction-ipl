-- ==========================================================================
-- COMBINED MIGRATION — Run this ONCE in the Supabase SQL Editor
-- Project: Mini Auction Room (IPL Edition)
-- ==========================================================================

-- ==============================
-- 1. SCHEMA
-- ==============================

CREATE TYPE room_status AS ENUM ('LOBBY', 'AUCTION', 'PAUSED', 'COMPLETED');
CREATE TYPE auction_player_status AS ENUM ('PENDING', 'ACTIVE', 'SOLD', 'UNSOLD');
CREATE TYPE player_role AS ENUM ('Batter', 'Wicketkeeper-Batter', 'All-rounder', 'Pace Bowler', 'Spin Bowler', 'Bowler');

CREATE TABLE players (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name       text          NOT NULL,
  player_name     text          NOT NULL,
  player_img_url  text,
  player_expert_in player_role  NOT NULL,
  nationality     text          NOT NULL,
  experience_years int          NOT NULL DEFAULT 0,
  base_price_lakhs int         NOT NULL,
  base_price_display text      NOT NULL,
  rating          decimal(3,1)
);

CREATE TABLE rooms (
  id                        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code                 varchar(6)    UNIQUE NOT NULL,
  room_name                 text          NOT NULL,
  admin_user_id             uuid          NOT NULL,
  status                    room_status   NOT NULL DEFAULT 'LOBBY',
  purse_budget_lakhs        int           NOT NULL DEFAULT 12000,
  max_squad_size            int           NOT NULL DEFAULT 18,
  bid_timer_seconds         int           NOT NULL DEFAULT 30,
  current_player_order_index int,
  created_at                timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE room_participants (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id               uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id               uuid        NOT NULL,
  display_name          text        NOT NULL,
  squad_name            text        NOT NULL,
  remaining_budget_lakhs int       NOT NULL,
  joined_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE room_players (
  id                        uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id                   uuid                  NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id                 uuid                  NOT NULL REFERENCES players(id),
  order_index               int                   NOT NULL,
  status                    auction_player_status NOT NULL DEFAULT 'PENDING',
  winning_participant_id    uuid                  REFERENCES room_participants(id),
  sold_price_lakhs          int,
  ends_at                   timestamptz,
  remaining_seconds_on_pause int,
  UNIQUE(room_id, player_id)
);

CREATE TABLE bids (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_player_id  uuid        NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  participant_id  uuid        NOT NULL REFERENCES room_participants(id) ON DELETE CASCADE,
  amount_lakhs    int         NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rooms_room_code              ON rooms(room_code);
CREATE INDEX idx_room_participants_room_id    ON room_participants(room_id);
CREATE INDEX idx_room_participants_user_id    ON room_participants(user_id);
CREATE INDEX idx_room_players_room_id         ON room_players(room_id);
CREATE INDEX idx_room_players_player_id       ON room_players(player_id);
CREATE INDEX idx_room_players_room_status     ON room_players(room_id, status);
CREATE INDEX idx_bids_room_id                 ON bids(room_id);
CREATE INDEX idx_bids_room_player_id          ON bids(room_player_id);
CREATE INDEX idx_bids_participant_id          ON bids(participant_id);
CREATE INDEX idx_bids_room_player_amount      ON bids(room_player_id, amount_lakhs DESC);

-- ==============================
-- 2. RLS — Permissive (no Supabase Auth, using client-generated UUIDs)
-- ==============================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- Allow all reads via publishable key (anon role)
CREATE POLICY "Players readable by all" ON players FOR SELECT TO anon USING (true);
CREATE POLICY "Rooms readable by all" ON rooms FOR SELECT TO anon USING (true);
CREATE POLICY "Participants readable by all" ON room_participants FOR SELECT TO anon USING (true);
CREATE POLICY "Room players readable by all" ON room_players FOR SELECT TO anon USING (true);
CREATE POLICY "Bids readable by all" ON bids FOR SELECT TO anon USING (true);

-- ==============================
-- 3. FUNCTIONS (SECURITY DEFINER — bypass RLS)
-- ==============================

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
  LOOP
    v_room_code := upper(substr(md5(random()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE room_code = v_room_code);
  END LOOP;

  INSERT INTO rooms (room_code, room_name, admin_user_id, purse_budget_lakhs, max_squad_size, bid_timer_seconds)
  VALUES (v_room_code, p_room_name, p_admin_user_id, p_purse_budget_lakhs, p_max_squad_size, p_bid_timer_seconds)
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
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.status != 'LOBBY' THEN RAISE EXCEPTION 'Room is not accepting new participants'; END IF;

  SELECT count(*) INTO v_participant_count FROM room_participants WHERE room_id = v_room.id;
  IF v_participant_count >= 5 THEN RAISE EXCEPTION 'Room is full (max 5 participants)'; END IF;

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
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.admin_user_id != p_admin_user_id THEN RAISE EXCEPTION 'Only the room admin can start the auction'; END IF;
  IF v_room.status != 'LOBBY' THEN RAISE EXCEPTION 'Auction can only be started from lobby'; END IF;

  SELECT count(*) INTO v_participant_count FROM room_participants WHERE room_id = p_room_id;
  IF v_participant_count < 2 THEN RAISE EXCEPTION 'Need at least 2 participants to start'; END IF;

  v_timer_seconds := v_room.bid_timer_seconds;

  INSERT INTO room_players (room_id, player_id, order_index)
  SELECT p_room_id, id, row_number() OVER (ORDER BY random())
  FROM players;

  GET DIAGNOSTICS v_total_players = ROW_COUNT;

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
  SELECT * INTO v_rp FROM room_players WHERE id = p_room_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found in auction'; END IF;
  IF v_rp.status != 'ACTIVE' THEN RAISE EXCEPTION 'This player is not currently up for auction'; END IF;
  IF v_rp.ends_at IS NOT NULL AND v_rp.ends_at <= now() THEN RAISE EXCEPTION 'Bidding time has expired'; END IF;

  SELECT base_price_lakhs INTO v_base_price FROM players WHERE id = v_rp.player_id;
  SELECT max(amount_lakhs) INTO v_current_highest FROM bids WHERE room_player_id = p_room_player_id;

  IF v_current_highest IS NULL THEN
    IF p_amount_lakhs < v_base_price THEN
      RAISE EXCEPTION 'Bid must be at least the base price (%s lakhs)', v_base_price;
    END IF;
  ELSE
    IF p_amount_lakhs <= v_current_highest THEN
      RAISE EXCEPTION 'Bid must be higher than current highest bid (%s lakhs)', v_current_highest;
    END IF;
  END IF;

  SELECT * INTO v_participant FROM room_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participant not found'; END IF;
  IF v_participant.remaining_budget_lakhs < p_amount_lakhs THEN
    RAISE EXCEPTION 'Insufficient budget. Available: %s lakhs', v_participant.remaining_budget_lakhs;
  END IF;

  SELECT * INTO v_room FROM rooms WHERE id = v_rp.room_id;
  SELECT count(*) INTO v_won_count FROM room_players
  WHERE room_id = v_rp.room_id AND winning_participant_id = p_participant_id AND status = 'SOLD';
  IF v_won_count >= v_room.max_squad_size THEN
    RAISE EXCEPTION 'Squad is full (%s/%s players)', v_won_count, v_room.max_squad_size;
  END IF;

  INSERT INTO bids (room_id, room_player_id, participant_id, amount_lakhs)
  VALUES (v_rp.room_id, p_room_player_id, p_participant_id, p_amount_lakhs)
  RETURNING id INTO v_bid_id;

  UPDATE room_players
  SET ends_at = GREATEST(ends_at, now() + interval '10 seconds')
  WHERE id = p_room_player_id;

  RETURN json_build_object('id', v_bid_id, 'amount_lakhs', p_amount_lakhs, 'participant_id', p_participant_id);
END;
$$;

CREATE OR REPLACE FUNCTION advance_to_next_player(p_room_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_next_rp record;
  v_timer_seconds int;
BEGIN
  SELECT bid_timer_seconds INTO v_timer_seconds FROM rooms WHERE id = p_room_id;
  SELECT * INTO v_next_rp FROM room_players WHERE room_id = p_room_id AND status = 'PENDING' ORDER BY order_index ASC LIMIT 1;
  IF FOUND THEN
    UPDATE room_players SET status = 'ACTIVE', ends_at = now() + (v_timer_seconds || ' seconds')::interval WHERE id = v_next_rp.id;
    UPDATE rooms SET current_player_order_index = v_next_rp.order_index WHERE id = p_room_id;
  ELSE
    UPDATE rooms SET status = 'COMPLETED' WHERE id = p_room_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION resolve_expired_auctions() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rp record;
  v_highest_bid record;
BEGIN
  FOR v_rp IN SELECT * FROM room_players WHERE status = 'ACTIVE' AND ends_at IS NOT NULL AND ends_at <= now() FOR UPDATE
  LOOP
    SELECT * INTO v_highest_bid FROM bids WHERE room_player_id = v_rp.id ORDER BY amount_lakhs DESC, created_at ASC LIMIT 1;
    IF FOUND THEN
      UPDATE room_players SET status = 'SOLD', winning_participant_id = v_highest_bid.participant_id, sold_price_lakhs = v_highest_bid.amount_lakhs WHERE id = v_rp.id;
      UPDATE room_participants SET remaining_budget_lakhs = remaining_budget_lakhs - v_highest_bid.amount_lakhs WHERE id = v_highest_bid.participant_id;
    ELSE
      UPDATE room_players SET status = 'UNSOLD' WHERE id = v_rp.id;
    END IF;
    PERFORM advance_to_next_player(v_rp.room_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION check_and_resolve(p_room_id uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rp record; v_highest_bid record; v_room record;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  SELECT * INTO v_rp FROM room_players WHERE room_id = p_room_id AND status = 'ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('status', v_room.status, 'active_player', NULL, 'resolved', false);
  END IF;
  IF v_rp.ends_at IS NOT NULL AND v_rp.ends_at <= now() THEN
    SELECT * INTO v_highest_bid FROM bids WHERE room_player_id = v_rp.id ORDER BY amount_lakhs DESC, created_at ASC LIMIT 1;
    IF FOUND THEN
      UPDATE room_players SET status = 'SOLD', winning_participant_id = v_highest_bid.participant_id, sold_price_lakhs = v_highest_bid.amount_lakhs WHERE id = v_rp.id;
      UPDATE room_participants SET remaining_budget_lakhs = remaining_budget_lakhs - v_highest_bid.amount_lakhs WHERE id = v_highest_bid.participant_id;
    ELSE
      UPDATE room_players SET status = 'UNSOLD' WHERE id = v_rp.id;
    END IF;
    PERFORM advance_to_next_player(p_room_id);
    SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
    RETURN json_build_object('status', v_room.status, 'resolved', true, 'result', CASE WHEN v_highest_bid IS NOT NULL THEN 'SOLD' ELSE 'UNSOLD' END);
  END IF;
  RETURN json_build_object('status', v_room.status, 'active_player_id', v_rp.id, 'ends_at', v_rp.ends_at, 'resolved', false);
END;
$$;

CREATE OR REPLACE FUNCTION pause_auction(p_room_id uuid, p_admin_user_id uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_room record; v_rp record;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.admin_user_id != p_admin_user_id THEN RAISE EXCEPTION 'Only admin can pause'; END IF;
  IF v_room.status != 'AUCTION' THEN RAISE EXCEPTION 'Can only pause during auction'; END IF;
  SELECT * INTO v_rp FROM room_players WHERE room_id = p_room_id AND status = 'ACTIVE';
  IF FOUND THEN
    UPDATE room_players SET remaining_seconds_on_pause = GREATEST(0, EXTRACT(EPOCH FROM (ends_at - now()))::int), ends_at = NULL WHERE id = v_rp.id;
  END IF;
  UPDATE rooms SET status = 'PAUSED' WHERE id = p_room_id;
  RETURN json_build_object('success', true, 'status', 'PAUSED');
END;
$$;

CREATE OR REPLACE FUNCTION resume_auction(p_room_id uuid, p_admin_user_id uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_room record; v_rp record;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.admin_user_id != p_admin_user_id THEN RAISE EXCEPTION 'Only admin can resume'; END IF;
  IF v_room.status != 'PAUSED' THEN RAISE EXCEPTION 'Can only resume a paused auction'; END IF;
  SELECT * INTO v_rp FROM room_players WHERE room_id = p_room_id AND status = 'ACTIVE';
  IF FOUND THEN
    UPDATE room_players SET ends_at = now() + (COALESCE(remaining_seconds_on_pause, v_room.bid_timer_seconds) || ' seconds')::interval, remaining_seconds_on_pause = NULL WHERE id = v_rp.id;
  END IF;
  UPDATE rooms SET status = 'AUCTION' WHERE id = p_room_id;
  RETURN json_build_object('success', true, 'status', 'AUCTION');
END;
$$;

CREATE OR REPLACE FUNCTION force_resolve_current_player(p_room_id uuid, p_admin_user_id uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_room record; v_rp record; v_highest_bid record; v_result text;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.admin_user_id != p_admin_user_id THEN RAISE EXCEPTION 'Only admin can force resolve'; END IF;
  SELECT * INTO v_rp FROM room_players WHERE room_id = p_room_id AND status = 'ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No active player to resolve'; END IF;
  SELECT * INTO v_highest_bid FROM bids WHERE room_player_id = v_rp.id ORDER BY amount_lakhs DESC, created_at ASC LIMIT 1;
  IF FOUND THEN
    UPDATE room_players SET status = 'SOLD', winning_participant_id = v_highest_bid.participant_id, sold_price_lakhs = v_highest_bid.amount_lakhs, ends_at = now() WHERE id = v_rp.id;
    UPDATE room_participants SET remaining_budget_lakhs = remaining_budget_lakhs - v_highest_bid.amount_lakhs WHERE id = v_highest_bid.participant_id;
    v_result := 'SOLD';
  ELSE
    UPDATE room_players SET status = 'UNSOLD', ends_at = now() WHERE id = v_rp.id;
    v_result := 'UNSOLD';
  END IF;
  PERFORM advance_to_next_player(p_room_id);
  RETURN json_build_object('success', true, 'result', v_result);
END;
$$;

CREATE OR REPLACE FUNCTION end_auction_early(p_room_id uuid, p_admin_user_id uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_room record; v_affected int;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room not found'; END IF;
  IF v_room.admin_user_id != p_admin_user_id THEN RAISE EXCEPTION 'Only admin can end auction'; END IF;
  UPDATE room_players SET status = 'UNSOLD', ends_at = NULL WHERE room_id = p_room_id AND status IN ('PENDING', 'ACTIVE');
  GET DIAGNOSTICS v_affected = ROW_COUNT;
  UPDATE rooms SET status = 'COMPLETED' WHERE id = p_room_id;
  RETURN json_build_object('success', true, 'unsold_count', v_affected);
END;
$$;

-- ==============================
-- 4. SEED DATA — 100 IPL Players
-- ==============================

INSERT INTO players (team_name, player_name, player_img_url, player_expert_in, nationality, experience_years, base_price_lakhs, base_price_display, rating)
VALUES
  ('RCB', 'Virat Kohli', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/2.png', 'Batter', 'India', 18, 2100, '₹21 Cr', 9.0),
  ('RCB', 'Rajat Patidar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/597.png', 'Batter', 'India', 5, 1100, '₹11 Cr', 8.0),
  ('RCB', 'Devdutt Padikkal', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/200.png', 'Batter', 'India', 6, 200, '₹2 Cr', 6.5),
  ('RCB', 'Phil Salt', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1220.png', 'Wicketkeeper-Batter', 'England', 5, 200, '₹2 Cr', 8.5),
  ('RCB', 'Jitesh Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1000.png', 'Wicketkeeper-Batter', 'India', 4, 200, '₹2 Cr', 7.0),
  ('RCB', 'Jordan Cox', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3372.png', 'Wicketkeeper-Batter', 'England', 3, 75, '₹75 Lakh', 5.5),
  ('RCB', 'Krunal Pandya', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/17.png', 'All-rounder', 'India', 10, 200, '₹2 Cr', 7.0),
  ('RCB', 'Venkatesh Iyer', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/584.png', 'All-rounder', 'India', 5, 200, '₹2 Cr', 7.0),
  ('RCB', 'Tim David', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/636.png', 'Batter', 'Australia', 5, 200, '₹2 Cr', 7.5),
  ('RCB', 'Romario Shepherd', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/371.png', 'All-rounder', 'West Indies', 6, 150, '₹1.5 Cr', 6.5),
  ('RCB', 'Swapnil Singh', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1483.png', 'All-rounder', 'India', 4, 30, '₹30 Lakh', 5.5),
  ('RCB', 'Jacob Bethell', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/869.png', 'All-rounder', 'England', 3, 100, '₹1 Cr', 7.0),
  ('RCB', 'Satvik Deswal', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4555.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('RCB', 'Mangesh Yadav', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4554.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 5.5),
  ('RCB', 'Vihaan Malhotra', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4012.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('RCB', 'Kanishk Chouhan', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4016.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('RCB', 'Vicky Ostwal', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/786.png', 'All-rounder', 'India', 3, 30, '₹30 Lakh', 5.0),
  ('RCB', 'Josh Hazlewood', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/36.png', 'Pace Bowler', 'Australia', 14, 200, '₹2 Cr', 8.5),
  ('RCB', 'Bhuvneshwar Kumar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/15.png', 'Pace Bowler', 'India', 14, 200, '₹2 Cr', 7.5),
  ('RCB', 'Yash Dayal', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/978.png', 'Pace Bowler', 'India', 4, 500, '₹5 Cr', 6.5),
  ('RCB', 'Richard Gleeson', 'https://documents.iplt20.com/ipl/assets/images/Default-Men.png', 'Pace Bowler', 'England', 10, 75, '₹75 Lakh', 6.0),
  ('RCB', 'Rasikh Dar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/172.png', 'Pace Bowler', 'India', 5, 30, '₹30 Lakh', 7.0),
  ('RCB', 'Suyash Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1932.png', 'Spin Bowler', 'India', 3, 30, '₹30 Lakh', 6.0),
  ('RCB', 'Jacob Duffy', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1701.png', 'Pace Bowler', 'New Zealand', 8, 200, '₹2 Cr', 5.5),
  ('RCB', 'Abhinandan Singh', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3574.png', 'Pace Bowler', 'India', 2, 30, '₹30 Lakh', 4.5);

INSERT INTO players (team_name, player_name, player_img_url, player_expert_in, nationality, experience_years, base_price_lakhs, base_price_display, rating)
VALUES
  ('GT', 'Shubman Gill', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/62.png', 'Batter', 'India', 8, 1650, '₹16.5 Cr', 9.0),
  ('GT', 'Jos Buttler', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/182.png', 'Wicketkeeper-Batter', 'England', 14, 200, '₹2 Cr', 8.5),
  ('GT', 'Kumar Kushagra', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3101.png', 'Wicketkeeper-Batter', 'India', 2, 30, '₹30 Lakh', 5.0),
  ('GT', 'Anuj Rawat', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/534.png', 'Wicketkeeper-Batter', 'India', 5, 30, '₹30 Lakh', 5.0),
  ('GT', 'Connor Esterhuizen', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/5035.png', 'Batter', 'South Africa', 2, 75, '₹75 Lakh', 5.0),
  ('GT', 'Glenn Phillips', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/635.png', 'Batter', 'New Zealand', 8, 200, '₹2 Cr', 7.0),
  ('GT', 'Sai Sudharsan', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/976.png', 'Batter', 'India', 4, 850, '₹8.5 Cr', 7.5),
  ('GT', 'Nishant Sindhu', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/791.png', 'All-rounder', 'India', 3, 30, '₹30 Lakh', 5.0),
  ('GT', 'Washington Sundar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/20.png', 'All-rounder', 'India', 9, 200, '₹2 Cr', 7.5),
  ('GT', 'Mohd. Arshad Khan', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/988.png', 'All-rounder', 'India', 2, 30, '₹30 Lakh', 5.0),
  ('GT', 'Sai Kishore', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/544.png', 'Spin Bowler', 'India', 5, 75, '₹75 Lakh', 6.5),
  ('GT', 'Jayant Yadav', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/165.png', 'All-rounder', 'India', 10, 75, '₹75 Lakh', 5.5),
  ('GT', 'Jason Holder', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/263.png', 'All-rounder', 'West Indies', 12, 200, '₹2 Cr', 7.5),
  ('GT', 'Rahul Tewatia', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/120.png', 'All-rounder', 'India', 9, 400, '₹4 Cr', 7.0),
  ('GT', 'Shahrukh Khan', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/590.png', 'All-rounder', 'India', 5, 400, '₹4 Cr', 6.5),
  ('GT', 'Kagiso Rabada', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/116.png', 'Pace Bowler', 'South Africa', 11, 200, '₹2 Cr', 9.0),
  ('GT', 'Mohammed Siraj', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/63.png', 'Pace Bowler', 'India', 9, 200, '₹2 Cr', 7.5),
  ('GT', 'Prasidh Krishna', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/150.png', 'Pace Bowler', 'India', 7, 200, '₹2 Cr', 7.0),
  ('GT', 'Manav Suthar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/2443.png', 'Spin Bowler', 'India', 2, 30, '₹30 Lakh', 5.5),
  ('GT', 'Gurnoor Singh Brar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1231.png', 'Pace Bowler', 'India', 3, 30, '₹30 Lakh', 5.5),
  ('GT', 'Ishant Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/50.png', 'Pace Bowler', 'India', 18, 75, '₹75 Lakh', 5.0),
  ('GT', 'Ashok Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/980.png', 'Pace Bowler', 'India', 2, 30, '₹30 Lakh', 5.0),
  ('GT', 'Luke Wood', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3116.png', 'Pace Bowler', 'England', 6, 75, '₹75 Lakh', 5.5),
  ('GT', 'Kulwant Khejroliya', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/204.png', 'Pace Bowler', 'India', 8, 30, '₹30 Lakh', 5.5),
  ('GT', 'Rashid Khan', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/218.png', 'Spin Bowler', 'Afghanistan', 10, 1800, '₹18 Cr', 9.0);

INSERT INTO players (team_name, player_name, player_img_url, player_expert_in, nationality, experience_years, base_price_lakhs, base_price_display, rating)
VALUES
  ('SRH', 'Ishan Kishan', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/164.png', 'Wicketkeeper-Batter', 'India', 8, 200, '₹2 Cr', 7.5),
  ('SRH', 'Aniket Verma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3576.png', 'Batter', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('SRH', 'Smaran Ravichandran', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3752.png', 'Batter', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('SRH', 'Salil Arora', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4556.png', 'Batter', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('SRH', 'Heinrich Klaasen', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/202.png', 'Wicketkeeper-Batter', 'South Africa', 8, 2300, '₹23 Cr', 9.0),
  ('SRH', 'Travis Head', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/37.png', 'Batter', 'Australia', 10, 1400, '₹14 Cr', 8.5),
  ('SRH', 'Harshal Patel', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/114.png', 'Pace Bowler', 'India', 12, 200, '₹2 Cr', 7.5),
  ('SRH', 'Kamindu Mendis', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/627.png', 'All-rounder', 'Sri Lanka', 5, 75, '₹75 Lakh', 7.0),
  ('SRH', 'Harsh Dubey', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1494.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('SRH', 'Shivang Kumar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4561.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('SRH', 'Krains Fuletra', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4557.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('SRH', 'Liam Livingstone', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/183.png', 'All-rounder', 'England', 8, 200, '₹2 Cr', 8.0),
  ('SRH', 'Abhishek Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/212.png', 'All-rounder', 'India', 5, 1400, '₹14 Cr', 8.0),
  ('SRH', 'Nitish Kumar Reddy', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1944.png', 'All-rounder', 'India', 3, 600, '₹6 Cr', 7.5),
  ('SRH', 'Pat Cummins', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/33.png', 'Pace Bowler', 'Australia', 15, 1800, '₹18 Cr', 9.0),
  ('SRH', 'Zeeshan Ansari', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3575.png', 'Spin Bowler', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('SRH', 'Jaydev Unadkat', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/180.png', 'Pace Bowler', 'India', 14, 100, '₹1 Cr', 5.5),
  ('SRH', 'Eshan Malinga', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3339.png', 'Pace Bowler', 'India', 2, 30, '₹30 Lakh', 5.0),
  ('SRH', 'Sakib Hussain', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3104.png', 'Pace Bowler', 'India', 1, 30, '₹30 Lakh', 4.5),
  ('SRH', 'Onkar Tarmale', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4560.png', 'Pace Bowler', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('SRH', 'Amit Kumar', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4559.png', 'Pace Bowler', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('SRH', 'Praful Hinge', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4558.png', 'Bowler', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('SRH', 'Dilshan Madushanka', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1018.png', 'Pace Bowler', 'Sri Lanka', 3, 75, '₹75 Lakh', 6.0),
  ('SRH', 'Gerald Coetzee', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/2535.png', 'Pace Bowler', 'South Africa', 4, 125, '₹1.25 Cr', 7.0),
  ('SRH', 'R.S. Ambrish', 'https://documents.iplt20.com/ipl/assets/images/Default-Men.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.0);

INSERT INTO players (team_name, player_name, player_img_url, player_expert_in, nationality, experience_years, base_price_lakhs, base_price_display, rating)
VALUES
  ('RR', 'Yashasvi Jaiswal', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/533.png', 'Batter', 'India', 6, 1800, '₹18 Cr', 9.0),
  ('RR', 'Dhruv Jurel', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1004.png', 'Wicketkeeper-Batter', 'India', 3, 1400, '₹14 Cr', 7.5),
  ('RR', 'Shimron Hetmyer', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/210.png', 'Batter', 'West Indies', 9, 1100, '₹11 Cr', 7.5),
  ('RR', 'Shubham Dubey', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3112.png', 'Batter', 'India', 3, 580, '₹5.8 Cr', 5.5),
  ('RR', 'Vaibhav Sooryavanshi', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3498.png', 'Batter', 'India', 2, 30, '₹30 Lakh', 6.5),
  ('RR', 'Lhuan-dre Pretorious', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/2827.png', 'Wicketkeeper-Batter', 'South Africa', 2, 30, '₹30 Lakh', 5.5),
  ('RR', 'Aman Rao Perala', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4552.png', 'Batter', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('RR', 'Riyan Parag', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/189.png', 'All-rounder', 'India', 7, 1400, '₹14 Cr', 8.0),
  ('RR', 'Ravindra Jadeja', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/46.png', 'All-rounder', 'India', 17, 1400, '₹14 Cr', 8.5),
  ('RR', 'Dasun Shanaka', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/375.png', 'All-rounder', 'Sri Lanka', 10, 75, '₹75 Lakh', 7.0),
  ('RR', 'Donovan Ferreira', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/2033.png', 'Wicketkeeper-Batter', 'South Africa', 3, 75, '₹75 Lakh', 5.5),
  ('RR', 'Yudhvir Singh Charak', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/587.png', 'All-rounder', 'India', 2, 30, '₹30 Lakh', 4.5),
  ('RR', 'Ravi Bishnoi', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/520.png', 'Spin Bowler', 'India', 6, 200, '₹2 Cr', 7.5),
  ('RR', 'Jofra Archer', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/181.png', 'Pace Bowler', 'England', 8, 200, '₹2 Cr', 8.5),
  ('RR', 'Tushar Deshpande', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/539.png', 'Pace Bowler', 'India', 6, 100, '₹1 Cr', 6.5),
  ('RR', 'Kwena Maphaka', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/801.png', 'Pace Bowler', 'South Africa', 2, 75, '₹75 Lakh', 6.5),
  ('RR', 'Nandre Burger', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/2806.png', 'Pace Bowler', 'South Africa', 4, 75, '₹75 Lakh', 6.5),
  ('RR', 'Sandeep Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/220.png', 'Pace Bowler', 'India', 12, 400, '₹4 Cr', 6.0),
  ('RR', 'Kuldeep Sen', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1005.png', 'Pace Bowler', 'India', 4, 50, '₹50 Lakh', 5.5),
  ('RR', 'Adam Milne', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/157.png', 'Pace Bowler', 'New Zealand', 12, 150, '₹1.5 Cr', 6.0),
  ('RR', 'Sushant Mishra', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/1016.png', 'Pace Bowler', 'India', 2, 50, '₹50 Lakh', 5.0),
  ('RR', 'Yash Raj Punja', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4553.png', 'Spin Bowler', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('RR', 'Brijesh Sharma', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/4551.png', 'Bowler', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('RR', 'Vignesh Puthur', 'https://documents.iplt20.com/ipl/IPLHeadshot2026/3566.png', 'Bowler', 'India', 1, 30, '₹30 Lakh', 4.0),
  ('RR', 'Emanjot Chahal', 'https://documents.iplt20.com/ipl/assets/images/Default-Men.png', 'All-rounder', 'India', 1, 30, '₹30 Lakh', 4.5);

-- ==============================
-- 5. ENABLE REALTIME
-- ==============================
-- REPLICA IDENTITY FULL is required for RLS-enabled tables so Realtime can
-- authorize and emit UPDATE/DELETE events to every subscriber (e.g. the
-- room_participants budget deduction must reach ALL clients, not just some).
ALTER TABLE rooms              REPLICA IDENTITY FULL;
ALTER TABLE room_participants  REPLICA IDENTITY FULL;
ALTER TABLE room_players       REPLICA IDENTITY FULL;
ALTER TABLE bids               REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE room_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE bids;
