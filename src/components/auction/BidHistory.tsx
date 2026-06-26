'use client';

import type { Bid, RoomParticipant } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

interface BidHistoryProps {
  bids: Bid[];
  participants: RoomParticipant[];
}

/**
 * Horizontal timeline showing the latest 5 bids as chips/pills.
 * The highest (newest) bid sits in the center with emphasis;
 * older bids fan out left/right, progressively fading.
 * Fixed height prevents layout shift during rapid bidding.
 */
export default function BidHistory({ bids, participants }: BidHistoryProps) {
  if (!bids || bids.length === 0) {
    return (
      <div className="flex items-center justify-center h-14 text-muted text-sm">
        No bids yet — be the first!
      </div>
    );
  }

  const participantMap = new Map(
    participants.map((p) => [p.id, p])
  );

  // Sorted by amount DESC → highest (newest) first
  const sorted = [...bids].sort(
    (a, b) => b.amount_lakhs - a.amount_lakhs
  );

  // Take latest 5
  const visible = sorted.slice(0, 5);

  // Styling per distance from center — center chip is prominent
  const chipStyle = (distFromCenter: number, isCenter: boolean) => {
    if (isCenter) {
      return 'bg-amber/15 border border-amber/40 scale-105 text-amber shadow-[0_0_16px_rgba(245,197,66,0.18)]';
    }
    const opacity = distFromCenter === 1 ? 'opacity-80' : 'opacity-55';
    const scale = distFromCenter === 1 ? 'scale-100' : 'scale-95';
    return `bg-surface border border-hairline ${opacity} ${scale} text-body`;
  };

  // Layout chips so the highest bid is in the center.
  // 5 slots: [ slot-2  slot-1  CENTER  slot+1  slot+2 ]
  const ordered: (typeof visible[number] | null)[] = new Array(5).fill(null);
  const centerIdx = 2;

  if (visible[0]) ordered[centerIdx] = visible[0];
  if (visible[1]) ordered[centerIdx - 1] = visible[1];
  if (visible[2]) ordered[centerIdx + 1] = visible[2];
  if (visible[3]) ordered[centerIdx - 2] = visible[3];
  if (visible[4]) ordered[centerIdx + 2] = visible[4];

  return (
    <div className="flex items-center justify-center gap-2 h-14 overflow-hidden">
      {ordered.map((bid, slotIdx) => {
        if (!bid) {
          // Invisible spacer to maintain centering
          return <div key={`slot-${slotIdx}`} className="w-20" />;
        }

        const distFromCenter = Math.abs(slotIdx - centerIdx);
        const isCenter = slotIdx === centerIdx;
        const p = bid.participant ?? participantMap.get(bid.participant_id);
        const squadName = p?.squad_name || 'Unknown';
        const displayName =
          squadName.length > 10 ? squadName.slice(0, 9) + '…' : squadName;

        return (
          <div
            key={bid.id}
            className={`flex flex-col items-center px-3 py-1.5 rounded-lg will-change-[transform,opacity] ${chipStyle(distFromCenter, isCenter)} ${
              isCenter
                ? 'animate-chip-enter'
                : 'transition-all duration-300 ease-out'
            }`}
          >
            <span
              className={`truncate max-w-[6rem] text-[11px] leading-tight ${
                isCenter ? 'font-semibold text-amber' : 'font-medium'
              }`}
            >
              {displayName}
            </span>
            <span
              className={`font-mono font-semibold leading-tight ${
                isCenter ? 'text-sm text-amber' : 'text-xs text-body'
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
