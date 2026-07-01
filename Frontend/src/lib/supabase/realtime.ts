import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Room, RoomParticipant, RoomPlayer, Bid } from '../types';

export interface RoomRealtimeCallbacks {
  onRoomUpdate?: (room: Room) => void;
  onParticipantChange?: (payload: {
    eventType: string;
    new: RoomParticipant;
    old: RoomParticipant;
  }) => void;
  onRoomPlayerChange?: (payload: {
    eventType: string;
    new: RoomPlayer;
    old: RoomPlayer;
  }) => void;
  onNewBid?: (bid: Bid) => void;
}

export function subscribeToRoom(
  supabase: SupabaseClient,
  roomId: string,
  callbacks: RoomRealtimeCallbacks
): RealtimeChannel {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomId}`,
      },
      (payload) => callbacks.onRoomUpdate?.(payload.new as Room)
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_participants',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) =>
        callbacks.onParticipantChange?.({
          eventType: payload.eventType,
          new: payload.new as RoomParticipant,
          old: payload.old as RoomParticipant,
        })
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'room_players',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) =>
        callbacks.onRoomPlayerChange?.({
          eventType: payload.eventType,
          new: payload.new as RoomPlayer,
          old: payload.old as RoomPlayer,
        })
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'bids',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => callbacks.onNewBid?.(payload.new as Bid)
    )
    .subscribe();

  return channel;
}

export function unsubscribeFromRoom(channel: RealtimeChannel): void {
  channel.unsubscribe();
}
