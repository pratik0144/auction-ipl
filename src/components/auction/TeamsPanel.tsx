'use client';

import { useState } from 'react';
import type { RoomParticipant, RoomPlayer, Player } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

interface TeamsPanelProps {
  participants: RoomParticipant[];
  soldPlayers: (RoomPlayer & { player: Player })[];
  currentUserId: string;
}

export default function TeamsPanel({
  participants,
  soldPlayers,
  currentUserId,
}: TeamsPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const otherParticipants = participants.filter(
    (p) => p.user_id !== currentUserId
  );

  if (otherParticipants.length === 0) {
    return (
      <div className="card">
        <h3 className="eyebrow mb-3">Teams</h3>
        <p className="text-sm text-muted text-center py-4">
          No other participants
        </p>
      </div>
    );
  }

  return (
    <div className="card flex flex-col overflow-hidden">
      <h3 className="text-xs text-muted uppercase tracking-wider font-semibold mb-3">
        Teams
      </h3>
      <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1">
        {otherParticipants.map((p) => {
          const playersBought = soldPlayers.filter(
            (sp) => sp.winning_participant_id === p.id
          );
          const isOpen = expanded === p.id;

          return (
            <div key={p.id} className="rounded-md bg-surface-raised border border-hairline">
              <button
                onClick={() => setExpanded(isOpen ? null : p.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-surface transition-colors rounded-md"
              >
                <div>
                  <p className="font-medium text-sm text-chalk">{p.squad_name}</p>
                  <p className="text-xs text-muted">
                    {formatPrice(p.remaining_budget_lakhs)} · {playersBought.length} players
                  </p>
                </div>
                <span className="text-muted text-xs">{isOpen ? '▾' : '▸'}</span>
              </button>
              {isOpen && playersBought.length > 0 && (
                <div className="px-3 pb-2 space-y-1 animate-fade-in">
                  {playersBought.map((sp) => (
                    <div
                      key={sp.id}
                      className="flex items-center justify-between text-xs py-0.5"
                    >
                      <span className="text-body truncate">
                        {sp.player.player_name}
                      </span>
                      <span className="font-mono text-muted shrink-0 ml-2">
                        {formatPrice(sp.sold_price_lakhs || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
