'use client';

import { useState, useEffect, useCallback } from 'react';

interface LocalUser {
  userId: string;
  participantId: string | null;
  roomId: string | null;
}

const STORAGE_KEY = 'auction_user';

function readStorage(): LocalUser {
  if (typeof window === 'undefined') {
    return { userId: '', participantId: null, roomId: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        userId: parsed.userId || crypto.randomUUID(),
        participantId: parsed.participantId || null,
        roomId: parsed.roomId || null,
      };
    }
  } catch {
    // ignore
  }
  const newUser: LocalUser = {
    userId: crypto.randomUUID(),
    participantId: null,
    roomId: null,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  return newUser;
}

export function useLocalUser() {
  const [user, setUser] = useState<LocalUser>({
    userId: '',
    participantId: null,
    roomId: null,
  });

  useEffect(() => {
    setUser(readStorage());
  }, []);

  const setParticipant = useCallback(
    (participantId: string, roomId: string) => {
      const updated = { ...user, participantId, roomId };
      setUser(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    },
    [user]
  );

  return { ...user, setParticipant };
}
