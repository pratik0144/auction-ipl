'use client';

import { useState } from 'react';
import { placeBid } from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { computeBidOptions } from '@/lib/bidCalculator';

interface BidButtonsProps {
  currentBidLakhs: number;
  basePriceLakhs: number;
  participantId: string;
  roomPlayerId: string;
  remainingBudget: number;
  maxSquadSize: number;
  currentSquadCount: number;
  isPaused: boolean;
  isExpired: boolean;
}

export default function BidButtons({
  currentBidLakhs,
  basePriceLakhs,
  participantId,
  roomPlayerId,
  remainingBudget,
  maxSquadSize,
  currentSquadCount,
  isPaused,
  isExpired,
}: BidButtonsProps) {
  const [bidding, setBidding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = computeBidOptions(
    basePriceLakhs,
    currentBidLakhs,
    remainingBudget,
  );

  const isSquadFull = currentSquadCount >= maxSquadSize;
  const noBidsAvailable = options.length === 0;

  async function handleBid(total: number) {
    setError(null);
    setBidding(total);

    const result = await placeBid({
      room_player_id: roomPlayerId,
      participant_id: participantId,
      amount_lakhs: total,
    });

    setBidding(null);

    if (result.error) {
      setError(result.error);
      setTimeout(() => setError(null), 3000);
    }
  }

  if (noBidsAvailable || isSquadFull) {
    return (
      <div className="space-y-2">
        <p className="text-muted text-sm text-center py-3">
          {isSquadFull
            ? 'Your squad is full — no more bids allowed'
            : 'Insufficient budget for any bid'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const disabled =
            isPaused || isExpired || bidding !== null;

          let disabledReason = '';
          if (isPaused) disabledReason = 'Auction is paused';
          else if (isExpired) disabledReason = "Time's up";

          return (
            <button
              key={opt.total}
              onClick={() => handleBid(opt.total)}
              disabled={disabled}
              title={disabledReason || undefined}
              className={`flex flex-col items-center justify-center py-3 px-2 rounded-md font-display font-semibold transition-all ${
                disabled
                  ? 'bg-surface border border-hairline text-muted cursor-not-allowed opacity-50'
                  : 'bg-surface-raised border border-amber/30 text-chalk hover:border-amber hover:bg-amber/10 active:scale-95'
              } ${bidding === opt.total ? 'animate-pulse-amber' : ''}`}
            >
              <span className="text-base text-amber">
                +{formatPrice(opt.increment)}
              </span>
              <span className="text-xs text-muted mt-0.5">
                = {formatPrice(opt.total)}
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-danger text-xs text-center animate-fade-in">
          {error}
        </p>
      )}
    </div>
  );
}
