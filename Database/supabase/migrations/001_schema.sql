-- ============================================================
-- 001_schema.sql – Core schema for IPL Auction Game
-- ============================================================

-- -----------------------------------------------
-- Enums
-- -----------------------------------------------
CREATE TYPE room_status AS ENUM ('LOBBY', 'AUCTION', 'PAUSED', 'COMPLETED');
CREATE TYPE auction_player_status AS ENUM ('PENDING', 'ACTIVE', 'SOLD', 'UNSOLD');
CREATE TYPE player_role AS ENUM ('Batter', 'Wicketkeeper-Batter', 'All-rounder', 'Pace Bowler', 'Spin Bowler', 'Bowler');

-- -----------------------------------------------
-- Table: players (static read-only catalog)
-- -----------------------------------------------
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

-- -----------------------------------------------
-- Table: rooms
-- -----------------------------------------------
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

-- -----------------------------------------------
-- Table: room_participants
-- -----------------------------------------------
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

-- -----------------------------------------------
-- Table: room_players
-- -----------------------------------------------
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

-- -----------------------------------------------
-- Table: bids
-- -----------------------------------------------
CREATE TABLE bids (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_player_id  uuid        NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  participant_id  uuid        NOT NULL REFERENCES room_participants(id) ON DELETE CASCADE,
  amount_lakhs    int         NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------
-- Indexes
-- -----------------------------------------------
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
