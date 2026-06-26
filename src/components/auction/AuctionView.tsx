'use client';

import { useState, useEffect, useRef } from 'react';
import type { RoomSnapshot, RoomParticipant, RoomPlayer, Player } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import { checkAndResolve } from '@/lib/api';
import PlayerCard from './PlayerCard';
import CountdownTimer from './CountdownTimer';
import BidHistory from './BidHistory';
import BidButtons from './BidButtons';
import BalancePanel from './BalancePanel';
import TeamsPanel from './TeamsPanel';
import MySquad from './MySquad';
import ChatPanel from './ChatPanel';

interface AuctionViewProps {
  snapshot: RoomSnapshot;
  participant: RoomParticipant;
  isAdmin: boolean;
  userId: string;
  myPlayers: (RoomPlayer & { player: Player })[];
}

interface InlineResult {
  result: 'SOLD' | 'UNSOLD';
  playerName: string;
  squadName?: string;
  price?: number;
}

export default function AuctionView({
  snapshot,
  participant,
  userId,
  myPlayers,
}: AuctionViewProps) {
  const { room, currentPlayer, participants, soldPlayers } = snapshot;
  const isPaused = room.status === 'PAUSED';

  // ---- Inline result state (replaces full-screen SoldMoment overlay) ----
  const prevPlayerRef = useRef<string | null>(null);
  const [inlineResult, setInlineResult] = useState<InlineResult | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentId = currentPlayer?.id ?? null;
    const prevId = prevPlayerRef.current;

    if (prevId && prevId !== currentId) {
      const resolved = [...snapshot.soldPlayers, ...snapshot.unsoldPlayers].find(
        (p) => p.id === prevId
      );
      if (resolved) {
        const winner = resolved.winning_participant_id
          ? participants.find((p) => p.id === resolved.winning_participant_id)
          : null;

        setInlineResult({
          result: resolved.status === 'SOLD' ? 'SOLD' : 'UNSOLD',
          playerName: resolved.player?.player_name || 'Unknown',
          squadName: winner?.squad_name,
          price: resolved.sold_price_lakhs || undefined,
        });

        // Clear any previous dismiss timer
        if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
        // Auto-dismiss after 3 seconds
        resultTimerRef.current = setTimeout(() => setInlineResult(null), 3000);
      }
    }

    prevPlayerRef.current = currentId;
  }, [currentPlayer?.id, snapshot.soldPlayers, snapshot.unsoldPlayers, participants]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
    };
  }, []);

  // ---- Auto-resolve: call checkAndResolve when timer expires ----
  const resolveCalledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentPlayer?.ends_at || isPaused) return;

    const endsAt = new Date(currentPlayer.ends_at).getTime();
    const now = Date.now();
    const remaining = endsAt - now;

    if (remaining <= 0) {
      if (resolveCalledRef.current === currentPlayer.id) return;
      resolveCalledRef.current = currentPlayer.id;

      const timer = setTimeout(async () => {
        await checkAndResolve(room.id);
      }, 500);
      return () => clearTimeout(timer);
    }

    resolveCalledRef.current = null;
    const timer = setTimeout(async () => {
      resolveCalledRef.current = currentPlayer.id;
      await new Promise((r) => setTimeout(r, 500));
      await checkAndResolve(room.id);
    }, remaining);

    return () => clearTimeout(timer);
  }, [currentPlayer?.id, currentPlayer?.ends_at, isPaused, room.id]);

  // ---- Current bid info ----
  const bids = currentPlayer?.bids ?? [];
  const highestBid =
    bids.length > 0 ? Math.max(...bids.map((b) => b.amount_lakhs)) : 0;
  const highestBidder =
    highestBid > 0
      ? participants.find(
          (p) =>
            p.id ===
            bids.find((b) => b.amount_lakhs === highestBid)?.participant_id
        )
      : null;

  // ---- No active player state ----
  if (!currentPlayer) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center animate-fade-in">
          <p className="text-3xl mb-3">⏳</p>
          <p className="text-muted">
            {isPaused ? 'Auction is paused' : 'Waiting for next player…'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Three-column layout — viewport-fixed, no scroll */}
      <div className="grid grid-cols-[260px_1fr_280px] gap-3 h-full p-3 overflow-hidden">
        {/* LEFT: My Squad */}
        <MySquad players={myPlayers} maxSquadSize={room.max_squad_size} />

        {/* CENTER: Auction */}
        <div className="flex flex-col gap-2 overflow-hidden min-h-0">
          {/* Player card — fixed height, no shrink */}
          <div className="shrink-0">
            <PlayerCard
              player={currentPlayer.player}
              basePrice={currentPlayer.player.base_price_lakhs}
            />
          </div>

          {/* Timer + Current bid + Bid History — fills remaining space */}
          <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-0 overflow-hidden">
            <div className="shrink-0">
              <CountdownTimer
                endsAt={currentPlayer.ends_at}
                isPaused={isPaused}
                timerSeconds={room.bid_timer_seconds}
                resultState={inlineResult}
              />
            </div>

            {/* Current highest bid */}
            <div className="text-center shrink-0">
              {highestBid > 0 ? (
                <>
                  <p className="font-mono text-2xl font-bold text-amber-glow">
                    {formatPrice(highestBid)}
                  </p>
                  <p className="text-sm text-muted mt-0.5">
                    by{' '}
                    <span className="text-chalk font-medium">
                      {highestBidder?.squad_name || 'Unknown'}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-muted text-sm">
                  Starting at{' '}
                  <span className="font-mono text-chalk">
                    {formatPrice(currentPlayer.player.base_price_lakhs)}
                  </span>
                </p>
              )}
            </div>

            {/* Bid History */}
            <div className="w-full max-w-md shrink-0">
              <BidHistory bids={bids} participants={participants} />
            </div>
          </div>

          {/* Bid Buttons — pinned at bottom, never shifts */}
          <div className="max-w-md mx-auto w-full shrink-0">
            <BidButtons
              currentBidLakhs={highestBid}
              basePriceLakhs={currentPlayer.player.base_price_lakhs}
              participantId={participant.id}
              roomPlayerId={currentPlayer.id}
              remainingBudget={participant.remaining_budget_lakhs}
              maxSquadSize={room.max_squad_size}
              currentSquadCount={myPlayers.length}
              isPaused={isPaused}
              isExpired={
                !!currentPlayer.ends_at &&
                new Date(currentPlayer.ends_at).getTime() <= Date.now()
              }
            />
          </div>

          {/* Progress bar — fixed at very bottom */}
          <div className="text-center shrink-0 py-0.5">
            <span className="text-xs text-muted">
              Player {snapshot.room.current_player_order_index || 1} of{' '}
              {snapshot.totalPlayers} ·{' '}
              {snapshot.soldPlayers.length} sold ·{' '}
              {snapshot.unsoldPlayers.length} unsold ·{' '}
              {snapshot.pendingCount} remaining
            </span>
          </div>
        </div>

        {/* RIGHT: Balance + Teams + Chat */}
        <div className="flex flex-col gap-2 overflow-hidden min-h-0">
          <div className="shrink-0">
            <BalancePanel
              remainingBudget={participant.remaining_budget_lakhs}
              totalBudget={room.purse_budget_lakhs}
              squadCount={myPlayers.length}
              maxSquadSize={room.max_squad_size}
              nextPlayer={snapshot.nextPlayer?.player ?? null}
            />
          </div>
          <div className="shrink-0 overflow-hidden" style={{ maxHeight: '30%' }}>
            <TeamsPanel
              participants={participants}
              soldPlayers={soldPlayers as (RoomPlayer & { player: Player })[]}
              currentUserId={userId}
            />
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            <ChatPanel
              roomId={room.id}
              participantId={participant.id}
              participants={participants}
            />
          </div>
        </div>
      </div>
    </>
  );
}
