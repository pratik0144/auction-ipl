// ============================================================================
// IPL Auction Game - Type Definitions
// ============================================================================

// Database enums as string unions
export type RoomStatus = 'LOBBY' | 'AUCTION' | 'PAUSED' | 'COMPLETED';
export type AuctionPlayerStatus = 'PENDING' | 'ACTIVE' | 'SOLD' | 'UNSOLD';
export type PlayerRole = 'Batter' | 'Wicketkeeper-Batter' | 'All-rounder' | 'Pace Bowler' | 'Spin Bowler' | 'Bowler';

// Database row types
export interface Player {
  id: string;
  team_name: string;
  player_name: string;
  player_img_url: string;
  player_expert_in: PlayerRole;
  nationality: string;
  experience_years: number;
  base_price_lakhs: number;
  base_price_display: string;
  rating: number;
}

export interface Room {
  id: string;
  room_code: string;
  room_name: string;
  admin_user_id: string;
  status: RoomStatus;
  purse_budget_lakhs: number;
  max_squad_size: number;
  bid_timer_seconds: number;
  current_player_order_index: number | null;
  created_at: string;
}

export interface RoomParticipant {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  squad_name: string;
  remaining_budget_lakhs: number;
  joined_at: string;
}

export interface RoomPlayer {
  id: string;
  room_id: string;
  player_id: string;
  order_index: number;
  status: AuctionPlayerStatus;
  winning_participant_id: string | null;
  sold_price_lakhs: number | null;
  ends_at: string | null;
  remaining_seconds_on_pause: number | null;
  // Joined fields
  player?: Player;
}

export interface Bid {
  id: string;
  room_id: string;
  room_player_id: string;
  participant_id: string;
  amount_lakhs: number;
  created_at: string;
  // Joined fields
  participant?: RoomParticipant;
}

// Composite types for frontend
export interface RoomSnapshot {
  room: Room;
  participants: RoomParticipant[];
  currentPlayer: (RoomPlayer & { player: Player; bids: Bid[] }) | null;
  nextPlayer: (RoomPlayer & { player: Player }) | null;
  soldPlayers: (RoomPlayer & { player: Player })[];
  unsoldPlayers: (RoomPlayer & { player: Player })[];
  pendingCount: number;
  totalPlayers: number;
}

// API types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export interface ApiError {
  message: string;
  code?: string;
}

// Request types
export interface CreateRoomRequest {
  room_name: string;
  admin_user_id: string;
  purse_budget_lakhs?: number;
  max_squad_size?: number;
  bid_timer_seconds?: number;
}

export interface JoinRoomRequest {
  room_code: string;
  user_id: string;
  display_name: string;
  squad_name: string;
}

export interface PlaceBidRequest {
  room_player_id: string;
  participant_id: string;
  amount_lakhs: number;
}

export interface AdminActionRequest {
  room_id: string;
  admin_user_id: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  participant_id: string;
  message: string;
  created_at: string;
  // Joined fields
  participant?: RoomParticipant;
}

export interface SendChatRequest {
  room_id: string;
  participant_id: string;
  message: string;
}
