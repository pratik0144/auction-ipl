-- ============================================================
-- 002_rls_policies.sql – Row Level Security policies
-- ============================================================
-- All writes go through SECURITY DEFINER RPC functions.
-- Only SELECT policies are defined here.

-- -----------------------------------------------
-- Enable RLS on all tables
-- -----------------------------------------------
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------
-- Players: public read access
-- -----------------------------------------------
CREATE POLICY "Players are viewable by everyone"
  ON players FOR SELECT
  USING (true);

-- -----------------------------------------------
-- Rooms: authenticated users can read
-- -----------------------------------------------
CREATE POLICY "Rooms are viewable by authenticated users"
  ON rooms FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------
-- Room participants: viewable by room members
-- -----------------------------------------------
CREATE POLICY "Participants are viewable by room members"
  ON room_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_participants.room_id
      AND rp.user_id = auth.uid()
    )
  );

-- -----------------------------------------------
-- Room players: viewable by room members
-- -----------------------------------------------
CREATE POLICY "Room players are viewable by room members"
  ON room_players FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_participants rp
      WHERE rp.room_id = room_players.room_id
      AND rp.user_id = auth.uid()
    )
  );

-- -----------------------------------------------
-- Bids: viewable by room members
-- -----------------------------------------------
CREATE POLICY "Bids are viewable by room members"
  ON bids FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM room_participants rp
      WHERE rp.room_id = bids.room_id
      AND rp.user_id = auth.uid()
    )
  );
