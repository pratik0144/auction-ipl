'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { RoomSnapshot, RoomPlayer, Player } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

interface ResultsViewProps {
  snapshot: RoomSnapshot;
}

export default function ResultsView({ snapshot }: ResultsViewProps) {
  const [copied, setCopied] = useState(false);
  const { room, participants, soldPlayers } = snapshot;

  function getParticipantPlayers(participantId: string) {
    return soldPlayers.filter(
      (sp) => sp.winning_participant_id === participantId
    ) as (RoomPlayer & { player: Player })[];
  }

  function getTotalSpent(participantId: string) {
    return getParticipantPlayers(participantId).reduce(
      (sum, sp) => sum + (sp.sold_price_lakhs || 0),
      0
    );
  }

  function handleShare() {
    const lines = [
      `🏏 ${room.room_name} — Auction Results\n`,
      ...participants.map((p) => {
        const players = getParticipantPlayers(p.id);
        const spent = getTotalSpent(p.id);
        return [
          `${p.squad_name} (${p.display_name})`,
          `  Spent: ${formatPrice(spent)} | Remaining: ${formatPrice(p.remaining_budget_lakhs)}`,
          `  Players (${players.length}): ${
            players.map((sp) => `${sp.player.player_name} (${formatPrice(sp.sold_price_lakhs || 0)})`).join(', ') || 'None'
          }`,
        ].join('\n');
      }),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Sort participants by total spent (highest first)
  const ranked = [...participants].sort(
    (a, b) => getTotalSpent(b.id) - getTotalSpent(a.id)
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-slide-up">
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-5xl mb-3">🏆</p>
        <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-chalk">Auction complete.</h2>
        <p className="text-body mt-2">{room.room_name}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button onClick={handleShare} className="btn-outline">
          {copied ? '✓ Copied!' : '📋 Share Results'}
        </button>
        <Link href="/" className="btn-primary">
          Exit to Home
        </Link>
      </div>

      {/* Participant cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ranked.map((p, i) => {
          const players = getParticipantPlayers(p.id);
          const spent = getTotalSpent(p.id);

          return (
            <div key={p.id} className="card-raised animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      i === 0
                        ? 'bg-amber/15 text-amber border border-amber/30'
                        : 'bg-surface-raised text-body border border-hairline'
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="font-display font-semibold">
                      {p.squad_name}
                    </h3>
                    <p className="text-xs text-muted">{p.display_name}</p>
                  </div>
                </div>
                {p.user_id === room.admin_user_id && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-link/15 text-link tracking-wide">
                    ADMIN
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                <div className="bg-surface rounded-md border border-hairline py-2">
                  <p className="font-mono text-sm font-semibold text-chalk">
                    {formatPrice(spent)}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">Spent</p>
                </div>
                <div className="bg-surface rounded-md border border-hairline py-2">
                  <p className="font-mono text-sm font-semibold text-chalk">
                    {formatPrice(p.remaining_budget_lakhs)}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">Remaining</p>
                </div>
                <div className="bg-surface rounded-md border border-hairline py-2">
                  <p className="font-mono text-sm font-semibold text-chalk">
                    {players.length}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">Players</p>
                </div>
              </div>

              {/* Player list */}
              <div className="space-y-1">
                {players.length === 0 ? (
                  <p className="text-center text-muted text-xs py-2">
                    No players won
                  </p>
                ) : (
                  players.map((sp) => (
                    <div
                      key={sp.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-surface border border-hairline text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-body truncate">
                          {sp.player.player_name}
                        </span>
                        <span className="text-[10px] text-muted shrink-0">
                          {sp.player.player_expert_in}
                        </span>
                      </div>
                      <span className="font-mono text-chalk shrink-0 ml-2">
                        {formatPrice(sp.sold_price_lakhs || 0)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
