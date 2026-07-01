-- ==========================================================================
-- CHAT FEATURE — Run this in the Supabase SQL Editor
-- ==========================================================================

CREATE TABLE room_chats (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id  uuid        NOT NULL REFERENCES room_participants(id) ON DELETE CASCADE,
  message         text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_chats_room_id ON room_chats(room_id);
CREATE INDEX idx_room_chats_created_at ON room_chats(room_id, created_at);

-- RLS
ALTER TABLE room_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chats readable by all" ON room_chats FOR SELECT TO anon USING (true);

-- Send chat function (SECURITY DEFINER to bypass RLS for insert)
CREATE OR REPLACE FUNCTION send_chat(
  p_room_id uuid,
  p_participant_id uuid,
  p_message text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_chat_id uuid;
  v_participant record;
BEGIN
  SELECT * INTO v_participant FROM room_participants WHERE id = p_participant_id AND room_id = p_room_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not a participant of this room'; END IF;

  IF length(trim(p_message)) = 0 THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;

  INSERT INTO room_chats (room_id, participant_id, message)
  VALUES (p_room_id, p_participant_id, trim(p_message))
  RETURNING id INTO v_chat_id;

  RETURN json_build_object(
    'id', v_chat_id,
    'room_id', p_room_id,
    'participant_id', p_participant_id,
    'message', trim(p_message)
  );
END;
$$;

-- Enable realtime for chats
ALTER PUBLICATION supabase_realtime ADD TABLE room_chats;
