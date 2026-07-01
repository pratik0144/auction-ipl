-- ==========================================================================
-- Migration 010: Auto-Complete When All Squads Full  &  Auction Rankings
-- ==========================================================================
-- Idempotent — safe to re-run (CREATE OR REPLACE).
--
-- 1. advance_to_next_player  – now checks whether every participant already
--    owns max_squad_size SOLD players.  If so, remaining PENDING players are
--    marked UNSOLD and the room moves to COMPLETED immediately.
--
-- 2. compute_auction_rankings – returns a JSON array ranking each participant
--    on team composition (40%), value efficiency (35%), and star power (25%).
-- ==========================================================================


-- ──────────────────────────────────────────────────────────────────────────
-- 1. advance_to_next_player  (updated)
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION advance_to_next_player(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_rp           record;
  v_timer_seconds     int;
  v_max_squad_size    int;
  v_total_participants int;
  v_full_squads       int;
BEGIN
  -- Fetch room settings
  SELECT bid_timer_seconds, max_squad_size
    INTO v_timer_seconds, v_max_squad_size
    FROM rooms
   WHERE id = p_room_id;

  -- ── Early-completion check ─────────────────────────────────────────────
  -- Count total participants in this room
  SELECT count(*)
    INTO v_total_participants
    FROM room_participants
   WHERE room_id = p_room_id;

  -- Count how many participants already own >= max_squad_size SOLD players
  SELECT count(*)
    INTO v_full_squads
    FROM (
      SELECT rp.winning_participant_id
        FROM room_players rp
       WHERE rp.room_id = p_room_id
         AND rp.status = 'SOLD'
       GROUP BY rp.winning_participant_id
      HAVING count(*) >= v_max_squad_size
    ) full_teams;

  -- If every participant has a full squad, end the auction early
  IF v_total_participants > 0 AND v_full_squads >= v_total_participants THEN
    -- Mark all remaining PENDING players as UNSOLD
    UPDATE room_players
       SET status = 'UNSOLD'
     WHERE room_id = p_room_id
       AND status = 'PENDING';

    -- Complete the room
    UPDATE rooms
       SET status = 'COMPLETED'
     WHERE id = p_room_id;

    RETURN;  -- done, no further processing
  END IF;

  -- ── Normal advance logic ───────────────────────────────────────────────
  SELECT *
    INTO v_next_rp
    FROM room_players
   WHERE room_id = p_room_id
     AND status = 'PENDING'
   ORDER BY order_index ASC
   LIMIT 1;

  IF FOUND THEN
    UPDATE room_players
       SET status  = 'ACTIVE',
           ends_at = now() + (v_timer_seconds || ' seconds')::interval
     WHERE id = v_next_rp.id;

    UPDATE rooms
       SET current_player_order_index = v_next_rp.order_index
     WHERE id = p_room_id;
  ELSE
    -- No more pending players — auction is complete
    UPDATE rooms
       SET status = 'COMPLETED'
     WHERE id = p_room_id;
  END IF;
END;
$$;


-- ──────────────────────────────────────────────────────────────────────────
-- 2. compute_auction_rankings
-- ──────────────────────────────────────────────────────────────────────────
-- Returns a JSON array of participant rankings for a completed (or active)
-- auction room.  Each element:
--   { rank, participant_id, display_name, squad_name, score,
--     composition_score, value_score, star_power_score,
--     total_spent, players_count }
--
-- Scoring weights:
--   Team Composition  40%  –  fulfillment of role quotas
--   Value Efficiency  35%  –  rating-to-premium ratio
--   Star Power        25%  –  average rating + experience bonus
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_auction_rankings(p_room_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  WITH
  -- ── Gather each participant's SOLD players with their attributes ──────
  participant_players AS (
    SELECT
      rp_sold.winning_participant_id  AS participant_id,
      p.player_expert_in              AS role,
      p.rating,
      p.experience_years,
      rp_sold.sold_price_lakhs,
      p.base_price_lakhs
    FROM room_players rp_sold
    JOIN players p ON p.id = rp_sold.player_id
    WHERE rp_sold.room_id = p_room_id
      AND rp_sold.status  = 'SOLD'
  ),

  -- ── Team Composition score (40%) ──────────────────────────────────────
  -- Ideal IPL squad minimums:
  --   >= 1 Wicketkeeper-Batter
  --   >= 2 Batter
  --   >= 2 Bowlers  (Pace Bowler + Spin Bowler + Bowler combined)
  --   >= 1 All-rounder
  -- Total required distinct role buckets to fill = 6
  --   (1 WK + 2 Bat + 2 Bowl + 1 AR)
  composition AS (
    SELECT
      participant_id,
      -- Count how many of the 6 role-slots are filled
      (
        -- Wicketkeeper slots (need 1)
        LEAST(count(*) FILTER (WHERE role = 'Wicketkeeper-Batter'), 1)
        -- Batter slots (need 2)
        + LEAST(count(*) FILTER (WHERE role = 'Batter'), 2)
        -- Bowler slots (need 2): combine Pace Bowler, Spin Bowler, Bowler
        + LEAST(
            count(*) FILTER (WHERE role IN ('Pace Bowler', 'Spin Bowler', 'Bowler')),
            2
          )
        -- All-rounder slots (need 1)
        + LEAST(count(*) FILTER (WHERE role = 'All-rounder'), 1)
      ) AS roles_fulfilled
    FROM participant_players
    GROUP BY participant_id
  ),
  composition_scored AS (
    SELECT
      participant_id,
      -- 6 total required slots; cap at 100
      LEAST((roles_fulfilled::numeric / 6.0) * 100, 100) AS composition_score
    FROM composition
  ),

  -- ── Value Efficiency score (35%) ──────────────────────────────────────
  -- For each SOLD player: rating / (sold_price / base_price)
  -- Higher = bought a high-rated player close to base price
  -- Normalised to 0-100 using min-max across participants in this room
  value_raw AS (
    SELECT
      participant_id,
      avg(
        CASE
          WHEN sold_price_lakhs > 0 AND base_price_lakhs > 0
          THEN rating / (sold_price_lakhs::numeric / base_price_lakhs::numeric)
          ELSE 0
        END
      ) AS avg_value
    FROM participant_players
    GROUP BY participant_id
  ),
  value_scored AS (
    SELECT
      participant_id,
      CASE
        WHEN max(avg_value) OVER () = min(avg_value) OVER ()
        THEN 100  -- all equal → everyone gets max
        ELSE
          ((avg_value - min(avg_value) OVER ())
           / NULLIF(max(avg_value) OVER () - min(avg_value) OVER (), 0))
          * 100
      END AS value_score
    FROM value_raw
  ),

  -- ── Star Power score (25%) ────────────────────────────────────────────
  -- Average rating of SOLD players, plus +0.5 bonus per experienced
  -- player (experience_years >= 10).  Normalised to 0-100.
  star_raw AS (
    SELECT
      participant_id,
      avg(COALESCE(rating, 0))
        + (count(*) FILTER (WHERE experience_years >= 10) * 0.5)
        AS raw_star
    FROM participant_players
    GROUP BY participant_id
  ),
  star_scored AS (
    SELECT
      participant_id,
      CASE
        WHEN max(raw_star) OVER () = min(raw_star) OVER ()
        THEN 100
        ELSE
          ((raw_star - min(raw_star) OVER ())
           / NULLIF(max(raw_star) OVER () - min(raw_star) OVER (), 0))
          * 100
      END AS star_power_score
    FROM star_raw
  ),

  -- ── Aggregate spending & player count ─────────────────────────────────
  spending AS (
    SELECT
      participant_id,
      COALESCE(sum(sold_price_lakhs), 0) AS total_spent,
      count(*)                           AS players_count
    FROM participant_players
    GROUP BY participant_id
  ),

  -- ── Final combined score ──────────────────────────────────────────────
  final AS (
    SELECT
      rpart.id                AS participant_id,
      rpart.display_name,
      rpart.squad_name,
      COALESCE(cs.composition_score, 0)   AS composition_score,
      COALESCE(vs.value_score, 0)         AS value_score,
      COALESCE(ss.star_power_score, 0)    AS star_power_score,
      COALESCE(sp.total_spent, 0)         AS total_spent,
      COALESCE(sp.players_count, 0)       AS players_count,
      -- Weighted final score
      round(
        (COALESCE(cs.composition_score, 0) * 0.40
         + COALESCE(vs.value_score, 0)     * 0.35
         + COALESCE(ss.star_power_score, 0) * 0.25
        )::numeric,
        2
      ) AS score
    FROM room_participants rpart
    LEFT JOIN composition_scored cs ON cs.participant_id = rpart.id
    LEFT JOIN value_scored       vs ON vs.participant_id = rpart.id
    LEFT JOIN star_scored        ss ON ss.participant_id = rpart.id
    LEFT JOIN spending           sp ON sp.participant_id = rpart.id
    WHERE rpart.room_id = p_room_id
  ),

  ranked AS (
    SELECT
      row_number() OVER (ORDER BY score DESC, total_spent ASC) AS rank,
      participant_id,
      display_name,
      squad_name,
      score,
      round(composition_score::numeric, 2)  AS composition_score,
      round(value_score::numeric, 2)        AS value_score,
      round(star_power_score::numeric, 2)   AS star_power_score,
      total_spent,
      players_count
    FROM final
  )

  SELECT json_agg(
    json_build_object(
      'rank',              rank,
      'participant_id',    participant_id,
      'display_name',      display_name,
      'squad_name',        squad_name,
      'score',             score,
      'composition_score', composition_score,
      'value_score',       value_score,
      'star_power_score',  star_power_score,
      'total_spent',       total_spent,
      'players_count',     players_count
    )
    ORDER BY rank
  )
  INTO v_result
  FROM ranked;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
