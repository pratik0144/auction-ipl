'use client';

import type { Player } from '@/lib/types';
import PlayerImage from './PlayerImage';

interface PlayerCardProps {
  player: Player;
  basePrice: number;
}

export default function PlayerCard({ player }: PlayerCardProps) {
  return (
    <div className="card-raised flex gap-4 items-stretch min-h-[150px] animate-fade-in overflow-hidden">
      {/* Photo — bleeds past the card's padding so it fills the panel height
          edge-to-edge (top/bottom/left); bg matches the card so transparent
          headshots have no visible seam. */}
      <PlayerImage
        player={player}
        className="self-stretch w-28 shrink-0 -my-5 -ml-5 rounded-l-[12px] bg-surface-raised"
        initialsClassName="text-3xl"
      />

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        {/* Heading: {playerName} - {teamName} */}
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em] text-chalk truncate">
          {player.player_name}
          <span className="text-body font-normal"> – {player.team_name}</span>
        </h2>

        {/* Row 1: role · nationality · Experience X years */}
        <div className="flex items-center gap-2 mt-1.5 text-sm text-body flex-wrap">
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-surface text-body border border-hairline">
            {player.player_expert_in}
          </span>
          <span className="text-muted">·</span>
          <span>{player.nationality}</span>
          <span className="text-muted">·</span>
          <span>Experience {player.experience_years} years</span>
        </div>

        {/* Row 2: Rating x/10 · BasePrice - ₹X Cr */}
        <div className="flex items-center gap-2 mt-1 text-sm flex-wrap">
          <span className="text-body">
            Rating{' '}
            <span className="font-mono font-semibold text-amber">
              {player.rating}/10
            </span>
          </span>
          <span className="text-muted">·</span>
          <span className="text-body">
            BasePrice -{' '}
            <span className="font-mono font-semibold text-chalk">
              {player.base_price_display}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
