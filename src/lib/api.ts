import { createClient } from './supabase/client';
import type {
  ApiResponse,
  Room,
  RoomParticipant,
  RoomPlayer,
  Player,
  Bid,
  RoomSnapshot,
  ChatMessage,
  CreateRoomRequest,
  JoinRoomRequest,
  PlaceBidRequest,
  AdminActionRequest,
  SendChatRequest,
} from './types';

function getSupabase() {
  return createClient();
}

async function rpc<T>(
  fnName: string,
  params: Record<string, unknown>
): Promise<ApiResponse<T>> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc(fnName, params);
  if (error) {
    return { data: null, error: error.message };
  }
  return { data: data as T, error: null };
}

export async function createRoom(
  req: CreateRoomRequest
): Promise<
  ApiResponse<{ id: string; room_code: string; room_name: string; participant_id: string }>
> {
  return rpc('create_room', {
    p_room_name: req.room_name,
    p_admin_user_id: req.admin_user_id,
    p_purse_budget_lakhs: req.purse_budget_lakhs ?? 12000,
    p_max_squad_size: req.max_squad_size ?? 18,
    p_bid_timer_seconds: req.bid_timer_seconds ?? 30,
  });
}

export async function joinRoom(
  req: JoinRoomRequest
): Promise<ApiResponse<RoomParticipant>> {
  return rpc('join_room', {
    p_room_code: req.room_code,
    p_user_id: req.user_id,
    p_display_name: req.display_name,
    p_squad_name: req.squad_name,
  });
}

export async function startAuction(
  req: AdminActionRequest
): Promise<
  ApiResponse<{ success: boolean; total_players: number; first_player_id: string }>
> {
  const fnName = process.env.NEXT_PUBLIC_DEV_MODE === 'true'
    ? 'start_auction_dev'
    : 'start_auction';
  return rpc(fnName, {
    p_room_id: req.room_id,
    p_admin_user_id: req.admin_user_id,
  });
}

export async function placeBid(
  req: PlaceBidRequest
): Promise<
  ApiResponse<{ id: string; amount_lakhs: number; participant_id: string }>
> {
  return rpc('place_bid', {
    p_room_player_id: req.room_player_id,
    p_participant_id: req.participant_id,
    p_amount_lakhs: req.amount_lakhs,
  });
}

export async function pauseAuction(
  req: AdminActionRequest
): Promise<ApiResponse<{ success: boolean; status: string }>> {
  return rpc('pause_auction', {
    p_room_id: req.room_id,
    p_admin_user_id: req.admin_user_id,
  });
}

export async function resumeAuction(
  req: AdminActionRequest
): Promise<ApiResponse<{ success: boolean; status: string }>> {
  return rpc('resume_auction', {
    p_room_id: req.room_id,
    p_admin_user_id: req.admin_user_id,
  });
}

export async function forceResolveCurrentPlayer(
  req: AdminActionRequest
): Promise<ApiResponse<{ success: boolean; result: string }>> {
  return rpc('force_resolve_current_player', {
    p_room_id: req.room_id,
    p_admin_user_id: req.admin_user_id,
  });
}

export async function endAuctionEarly(
  req: AdminActionRequest
): Promise<ApiResponse<{ success: boolean; unsold_count: number }>> {
  return rpc('end_auction_early', {
    p_room_id: req.room_id,
    p_admin_user_id: req.admin_user_id,
  });
}

export async function checkAndResolve(
  roomId: string
): Promise<ApiResponse<Record<string, unknown>>> {
  return rpc('check_and_resolve', { p_room_id: roomId });
}

export async function getRoomSnapshot(
  roomId: string
): Promise<ApiResponse<RoomSnapshot>> {
  const supabase = getSupabase();

  // Fetch room
  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();
  if (roomError) return { data: null, error: roomError.message };

  // Fetch participants
  const { data: participants, error: partError } = await supabase
    .from('room_participants')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at', { ascending: true });
  if (partError) return { data: null, error: partError.message };

  // Fetch room_players with joined player data
  const { data: roomPlayers, error: rpError } = await supabase
    .from('room_players')
    .select('*, player:players(*)')
    .eq('room_id', roomId)
    .order('order_index', { ascending: true });
  if (rpError) return { data: null, error: rpError.message };

  // Find active player and fetch its bids
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

  // Next up = the PENDING player with the lowest order_index (roomPlayers is
  // already ordered by order_index asc). Matches advance_to_next_player.
  const nextPlayer =
    roomPlayers?.find(
      (rp: RoomPlayer & { player: unknown }) => rp.status === 'PENDING'
    ) ?? null;

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

  return {
    data: {
      room: room as Room,
      participants: (participants ?? []) as RoomParticipant[],
      currentPlayer,
      nextPlayer: nextPlayer as (RoomPlayer & { player: Player }) | null,
      soldPlayers,
      unsoldPlayers,
      pendingCount,
      totalPlayers: roomPlayers?.length ?? 0,
    },
    error: null,
  };
}

export async function getRoomResults(roomId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('room_players')
    .select(
      '*, player:players(*), winner:room_participants!room_players_winning_participant_id_fkey(*)'
    )
    .eq('room_id', roomId)
    .in('status', ['SOLD', 'UNSOLD'])
    .order('order_index', { ascending: true });

  if (error) return { data: null, error: error.message };
  return { data, error: null };
}

// ============================================================
// Chat
// ============================================================

export async function sendChat(
  req: SendChatRequest
): Promise<ApiResponse<{ id: string }>> {
  return rpc('send_chat', {
    p_room_id: req.room_id,
    p_participant_id: req.participant_id,
    p_message: req.message,
  });
}

export async function getRoomChats(roomId: string): Promise<ApiResponse<ChatMessage[]>> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('room_chats')
    .select('*, participant:room_participants(*)')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) return { data: null, error: error.message };
  return { data: data as ChatMessage[], error: null };
}
