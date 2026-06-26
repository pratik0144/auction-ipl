'use client';

import type { Player } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import PlayerImage from './PlayerImage';

interface BalancePanelProps {
  remainingBudget: number;
  totalBudget: number;
  squadCount: number;
  maxSquadSize: number;
  nextPlayer: Player | null;
}

export default function BalancePanel({
  remainingBudget,
  totalBudget,
  squadCount,
  maxSquadSize,
  nextPlayer,
}: BalancePanelProps) {
  const spent = totalBudget - remainingBudget;
  const spentPercent = totalBudget > 0 ? (spent / totalBudget) * 100 : 0;
  const canPeek = !!nextPlayer;

  return (
    <div className="card group" style={{ perspective: '1200px' }}>
      <div
        className={`relative transition-transform duration-500 ease-out [transform-style:preserve-3d] ${
          canPeek ? 'group-hover:[transform:rotateY(180deg)]' : ''
        }`}
        style={{ minHeight: '150px' }}
      >
        {/* ---- FRONT: balance ---- */}
        <div className="[backface-visibility:hidden] space-y-3">
          <h3 className="eyebrow">Balance</h3>

          {/* Remaining budget */}
          <div>
            <p className="font-display text-2xl font-semibold tracking-[-0.02em] text-chalk">
              {formatPrice(remainingBudget)}
            </p>
            <p className="text-xs text-muted mt-0.5">remaining</p>
          </div>

          {/* Progress bar */}
          <div>
            <div className="h-2 rounded-full bg-surface-raised border border-hairline overflow-hidden">
              <div
                className="h-full rounded-full bg-chalk transition-all duration-300"
                style={{ width: `${spentPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted">Spent: {formatPrice(spent)}</span>
              <span className="text-[10px] text-muted">{formatPrice(totalBudget)}</span>
            </div>
          </div>

          {/* Squad count */}
          <div className="flex items-center justify-between pt-2 border-t border-hairline">
            <span className="text-xs text-muted">Squad</span>
            <span className="font-mono text-sm font-semibold text-chalk">
              {squadCount}
              <span className="text-muted">/{maxSquadSize}</span>
            </span>
          </div>

          {canPeek && (
            <p className="eyebrow text-[10px] opacity-60 pt-1 text-center">
              Hover to peek next ↑
            </p>
          )}
        </div>

        {/* ---- BACK: next-up player preview ---- */}
        {canPeek && nextPlayer && (
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col items-center justify-center gap-3 text-center">
            <span className="eyebrow text-[10px]">Next up</span>
            <PlayerImage
              player={nextPlayer}
              className="w-20 h-20 rounded-lg border border-hairline bg-surface"
            />
            <p className="font-display font-semibold tracking-[-0.02em] text-chalk leading-tight px-2">
              {nextPlayer.player_name}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
