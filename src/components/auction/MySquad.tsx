'use client';

import type { RoomPlayer, Player } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import PlayerImage from './PlayerImage';

interface MySquadProps {
  players: (RoomPlayer & { player: Player })[];
  maxSquadSize: number;
}

export default function MySquad({ players, maxSquadSize }: MySquadProps) {
  const emptySlots = Math.max(0, maxSquadSize - players.length);

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      <h3 className="eyebrow mb-3">My Squad</h3>

      <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 pr-1">
        {players.map((sp) => (
          <div
            key={sp.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-raised border border-hairline"
          >
            <PlayerImage
              player={sp.player}
              className="w-7 h-7 rounded-md border border-hairline bg-surface shrink-0"
              initialsClassName="text-[10px]"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-chalk truncate">
                {sp.player.player_name}
              </p>
              <p className="text-[10px] text-muted">
                {sp.player.player_expert_in}
              </p>
            </div>
            <span className="font-mono text-xs text-body shrink-0">
              {formatPrice(sp.sold_price_lakhs || 0)}
            </span>
          </div>
        ))}

        {/* Empty slots */}
        {Array.from({ length: Math.min(emptySlots, 8) }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex items-center justify-center px-2 py-2.5 rounded-md border border-dashed border-hairline"
          >
            <span className="text-[10px] text-muted">Empty slot</span>
          </div>
        ))}
        {emptySlots > 8 && (
          <p className="text-[10px] text-muted text-center">
            +{emptySlots - 8} more slots
          </p>
        )}
      </div>

      {/* Count */}
      <div className="pt-2 mt-2 border-t border-hairline text-center">
        <span className="text-xs text-muted">
          {players.length}/{maxSquadSize} filled
        </span>
      </div>
    </div>
  );
}
