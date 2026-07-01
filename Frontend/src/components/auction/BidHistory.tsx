'use client';

import type { Bid, RoomParticipant } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

interface BidHistoryProps {
  bids: Bid[];
  participants: RoomParticipant[];
}

/**
 * Compact, center-anchored bid history. The latest (highest) bid sits in the
 * CENTER; older bids fan out left/right and fade. Fixed-width slots (with
 * spacers) keep the center fixed so the newest bid never drifts off-screen.
 * Text only — name + amount, no boxes/animations.
 */
export default function BidHistory({ bids, participants }: BidHistoryProps) {
  if (!bids || bids.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted text-sm">
        No bids yet — be the first!
      </div>
    );
  }

  const participantMap = new Map(participants.map((p) => [p.id, p]));

  // Highest (latest) first.
  const visible = [...bids]
    .sort((a, b) => b.amount_lakhs - a.amount_lakhs)
    .slice(0, 5);

  // Place the highest in the center, older bids alternating outward:
  // [ #4  #2  CENTER(#1)  #3  #5 ]
  const ordered: (Bid | null)[] = [null, null, null, null, null];
  const centerIdx = 2;
  if (visible[0]) ordered[centerIdx] = visible[0];
  if (visible[1]) ordered[centerIdx - 1] = visible[1];
  if (visible[2]) ordered[centerIdx + 1] = visible[2];
  if (visible[3]) ordered[centerIdx - 2] = visible[3];
  if (visible[4]) ordered[centerIdx + 2] = visible[4];

  return (
    <div className="flex items-center justify-center gap-1 overflow-hidden">
      {ordered.map((bid, slotIdx) => {
        if (!bid) {
          // Spacer keeps the center slot truly centered.
          return <div key={`slot-${slotIdx}`} className="w-20 shrink-0" />;
        }

        const dist = Math.abs(slotIdx - centerIdx);
        const isCenter = slotIdx === centerIdx;
        const p = bid.participant ?? participantMap.get(bid.participant_id);
        const rawName = p?.display_name || 'Unknown';
        const name = rawName.length > 9 ? rawName.slice(0, 8) + '…' : rawName;
        const fade = isCenter ? '' : dist === 1 ? 'opacity-70' : 'opacity-40';

        return (
          <div
            key={bid.id}
            className={`w-20 shrink-0 flex flex-col items-center leading-tight transition-opacity duration-300 ${fade}`}
          >
            <span
              className={`truncate max-w-full text-[11px] ${
                isCenter ? 'text-chalk font-medium' : 'text-muted'
              }`}
            >
              {name}
            </span>
            <span
              className={`font-mono ${
                isCenter ? 'text-sm font-semibold text-amber' : 'text-xs text-muted'
              }`}
            >
              {formatPrice(bid.amount_lakhs)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
