'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getRoomSnapshot } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { subscribeToRoom, unsubscribeFromRoom } from '@/lib/supabase/realtime';
import type { RoomSnapshot } from '@/lib/types';

export function useRoom(roomId: string) {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof subscribeToRoom> | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!roomId) return;
    const result = await getRoomSnapshot(roomId);
    if (result.error) {
      setError(result.error);
      setSnapshot(null);
    } else {
      setSnapshot(result.data);
      setError(null);
    }
    setLoading(false);
  }, [roomId]);

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchSnapshot();
  }, [fetchSnapshot]);

  // Realtime subscription
  useEffect(() => {
    if (!roomId) return;
    const supabase = createClient();

    channelRef.current = subscribeToRoom(supabase, roomId, {
      onRoomUpdate: (room) => {
        // Patch the room immediately for a snappy status/timer change…
        setSnapshot((prev) => (prev ? { ...prev, room } : null));
        // …then reconcile the FULL snapshot. Every auction resolution updates
        // the rooms row (advance_to_next_player), so this guarantees every
        // client re-pulls all participants' budgets after each sale — even if
        // a room_participants realtime UPDATE never reaches this client.
        fetchSnapshot();
      },
      onParticipantChange: () => {
        // A participant's budget/identity changed — refetch for all clients.
        fetchSnapshot();
      },
      onRoomPlayerChange: () => {
        // Refetch full snapshot when player status changes
        fetchSnapshot();
      },
      onNewBid: () => {
        // Refetch to get updated bid list
        fetchSnapshot();
      },
    });

    return () => {
      if (channelRef.current) {
        unsubscribeFromRoom(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId, fetchSnapshot]);

  return { snapshot, loading, error, refetch: fetchSnapshot };
}
