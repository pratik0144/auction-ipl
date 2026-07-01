'use client';

import { useMemo } from 'react';
import type { RoomSnapshot, RoomParticipant, RoomPlayer, Player } from '@/lib/types';

export function useParticipant(
  snapshot: RoomSnapshot | null,
  userId: string
) {
  const participant: RoomParticipant | null = useMemo(() => {
    if (!snapshot || !userId) return null;
    return (
      snapshot.participants.find((p) => p.user_id === userId) ?? null
    );
  }, [snapshot, userId]);

  const isAdmin = useMemo(() => {
    if (!snapshot || !participant) return false;
    return snapshot.room.admin_user_id === userId;
  }, [snapshot, participant, userId]);

  const myPlayers: (RoomPlayer & { player: Player })[] = useMemo(() => {
    if (!snapshot || !participant) return [];
    return snapshot.soldPlayers.filter(
      (sp) => sp.winning_participant_id === participant.id
    ) as (RoomPlayer & { player: Player })[];
  }, [snapshot, participant]);

  return { participant, isAdmin, myPlayers };
}
