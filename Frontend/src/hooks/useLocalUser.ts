'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';

interface LocalUser {
  userId: string;
  participantId: string | null;
  roomId: string | null;
}

const STORAGE_KEY = 'auction_user';

function readParticipantData(): { participantId: string | null; roomId: string | null } {
  if (typeof window === 'undefined') {
    return { participantId: null, roomId: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        participantId: parsed.participantId || null,
        roomId: parsed.roomId || null,
      };
    }
  } catch {
    // ignore
  }
  return { participantId: null, roomId: null };
}

export function useLocalUser() {
  const { user, loading } = useAuth();

  const [participantData, setParticipantData] = useState(() => readParticipantData());

  const userId = user?.id ?? '';

  const setParticipant = useCallback(
    (participantId: string, roomId: string) => {
      const updated = { participantId, roomId };
      setParticipantData(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...updated, userId }));
    },
    [userId]
  );

  return {
    userId,
    participantId: participantData.participantId,
    roomId: participantData.roomId,
    setParticipant,
    loading,
  };
}
