import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { RoomPlayer } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomId } = await params;
    const supabase = await createServerSupabaseClient();

    // Fetch room
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();
    if (roomError) {
      return NextResponse.json({ error: roomError.message }, { status: 404 });
    }

    // Fetch participants
    const { data: participants } = await supabase
      .from('room_participants')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true });

    // Fetch room_players with player data
    const { data: roomPlayers } = await supabase
      .from('room_players')
      .select('*, player:players(*)')
      .eq('room_id', roomId)
      .order('order_index', { ascending: true });

    // Find active player and its bids
    const activePlayer =
      roomPlayers?.find(
        (rp: RoomPlayer & { player: unknown }) => rp.status === 'ACTIVE'
      ) ?? null;
    let currentPlayer = null;
    if (activePlayer) {
      const { data: bids } = await supabase
        .from('bids')
        .select('*, participant:room_participants(*)')
        .eq('room_player_id', activePlayer.id)
        .order('amount_lakhs', { ascending: false });
      currentPlayer = { ...activePlayer, bids: bids ?? [] };
    }

    const soldPlayers =
      roomPlayers?.filter(
        (rp: RoomPlayer & { player: unknown }) => rp.status === 'SOLD'
      ) ?? [];
    const unsoldPlayers =
      roomPlayers?.filter(
        (rp: RoomPlayer & { player: unknown }) => rp.status === 'UNSOLD'
      ) ?? [];
    const pendingCount =
      roomPlayers?.filter(
        (rp: RoomPlayer & { player: unknown }) => rp.status === 'PENDING'
      ).length ?? 0;

    return NextResponse.json({
      data: {
        room,
        participants: participants ?? [],
        currentPlayer,
        soldPlayers,
        unsoldPlayers,
        pendingCount,
        totalPlayers: roomPlayers?.length ?? 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
