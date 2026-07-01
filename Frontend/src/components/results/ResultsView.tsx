'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { RoomSnapshot, RoomPlayer, Player, RoomParticipant, PlayerRole } from '@/lib/types';
import { formatPrice } from '@/lib/utils';
import PlayerImage from '@/components/auction/PlayerImage';

interface ResultsViewProps {
  snapshot: RoomSnapshot;
}

// ── Ranking logic ──────────────────────────────────────────────────────────

interface ParticipantRanking {
  participant: RoomParticipant;
  rank: number;
  totalScore: number;
  compositionScore: number;
  valueScore: number;
  starPowerScore: number;
  totalSpent: number;
  players: (RoomPlayer & { player: Player })[];
  roleCounts: Record<string, number>;
}

const ROLE_LABELS: Record<string, string> = {
  Batter: 'BAT',
  'Wicketkeeper-Batter': 'WK',
  'All-rounder': 'AR',
  'Pace Bowler': 'PACE',
  'Spin Bowler': 'SPIN',
  Bowler: 'BOWL',
};

/**
 * Ideal IPL squad composition requirements (minimum counts).
 * These are role minimums a balanced squad needs — the scoring
 * rewards fulfilling ALL of them.
 */
const REQUIRED_ROLES: { role: PlayerRole | 'Bowler_any'; label: string; min: number }[] = [
  { role: 'Batter', label: 'Batters', min: 2 },
  { role: 'Wicketkeeper-Batter', label: 'Wicket-keepers', min: 1 },
  { role: 'All-rounder', label: 'All-rounders', min: 1 },
  { role: 'Bowler_any', label: 'Bowlers (any type)', min: 2 },
];

function isBowler(role: PlayerRole): boolean {
  return role === 'Pace Bowler' || role === 'Spin Bowler' || role === 'Bowler';
}

function computeCompositionScore(
  players: (RoomPlayer & { player: Player })[]
): { score: number; roleCounts: Record<string, number> } {
  const roleCounts: Record<string, number> = {};
  for (const sp of players) {
    const role = sp.player.player_expert_in;
    roleCounts[role] = (roleCounts[role] || 0) + 1;
  }

  let fulfilled = 0;
  const totalRequired = REQUIRED_ROLES.length;

  for (const req of REQUIRED_ROLES) {
    if (req.role === 'Bowler_any') {
      const bowlerCount =
        (roleCounts['Pace Bowler'] || 0) +
        (roleCounts['Spin Bowler'] || 0) +
        (roleCounts['Bowler'] || 0);
      if (bowlerCount >= req.min) fulfilled++;
    } else {
      if ((roleCounts[req.role] || 0) >= req.min) fulfilled++;
    }
  }

  return {
    score: Math.min(100, (fulfilled / totalRequired) * 100),
    roleCounts,
  };
}

function computeValueScore(
  players: (RoomPlayer & { player: Player })[]
): number {
  if (players.length === 0) return 0;

  let totalValue = 0;
  for (const sp of players) {
    const rating = sp.player.rating || 5;
    const basePrice = sp.player.base_price_lakhs || 1;
    const soldPrice = sp.sold_price_lakhs || basePrice;
    // Value = rating * (base / sold). Higher when you get high-rated players
    // at or near base price. A steal = base/sold ≈ 1, an overpay = base/sold < 1.
    const priceRatio = basePrice / soldPrice;
    totalValue += rating * priceRatio;
  }

  const avgValue = totalValue / players.length;
  // Normalize: perfect score = rating 9.0 bought at base (ratio 1.0) = 9.0
  // Scale so 9.0 → 100
  return Math.min(100, (avgValue / 9) * 100);
}

function computeStarPowerScore(
  players: (RoomPlayer & { player: Player })[]
): number {
  if (players.length === 0) return 0;

  let totalStar = 0;
  for (const sp of players) {
    let starPoints = (sp.player.rating || 0);
    // Bonus for experienced veterans (10+ years)
    if (sp.player.experience_years >= 10) starPoints += 1.0;
    // Slight bonus for internationals with high rating
    if (sp.player.nationality !== 'India' && (sp.player.rating || 0) >= 8.0) starPoints += 0.5;
    totalStar += starPoints;
  }

  const avgStar = totalStar / players.length;
  // Normalize: max theoretical ≈ 10.5 (9.0 rating + 1.0 exp bonus + 0.5 intl)
  return Math.min(100, (avgStar / 10.5) * 100);
}

function computeRankings(snapshot: RoomSnapshot): ParticipantRanking[] {
  const { participants, soldPlayers } = snapshot;

  const rankings: ParticipantRanking[] = participants.map((p) => {
    const myPlayers = soldPlayers.filter(
      (sp) => sp.winning_participant_id === p.id
    ) as (RoomPlayer & { player: Player })[];

    const totalSpent = myPlayers.reduce(
      (sum, sp) => sum + (sp.sold_price_lakhs || 0),
      0
    );

    const { score: compositionScore, roleCounts } = computeCompositionScore(myPlayers);
    const valueScore = computeValueScore(myPlayers);
    const starPowerScore = computeStarPowerScore(myPlayers);

    const totalScore =
      compositionScore * 0.40 +
      valueScore * 0.35 +
      starPowerScore * 0.25;

    return {
      participant: p,
      rank: 0,
      totalScore,
      compositionScore,
      valueScore,
      starPowerScore,
      totalSpent,
      players: myPlayers,
      roleCounts,
    };
  });

  // Sort by total score descending
  rankings.sort((a, b) => b.totalScore - a.totalScore);
  rankings.forEach((r, i) => (r.rank = i + 1));

  return rankings;
}

// ── Medal helpers ──────────────────────────────────────────────────────────

const MEDAL_STYLES: Record<number, { bg: string; border: string; text: string; emoji: string }> = {
  1: {
    bg: 'bg-amber/15',
    border: 'border-amber/40 ring-1 ring-amber/20',
    text: 'text-amber',
    emoji: '🥇',
  },
  2: {
    bg: 'bg-[#c0c0c0]/10',
    border: 'border-[#c0c0c0]/30',
    text: 'text-[#c0c0c0]',
    emoji: '🥈',
  },
  3: {
    bg: 'bg-[#cd7f32]/10',
    border: 'border-[#cd7f32]/30',
    text: 'text-[#cd7f32]',
    emoji: '🥉',
  },
};

function getRankStyle(rank: number) {
  return MEDAL_STYLES[rank] || {
    bg: 'bg-surface-raised',
    border: 'border-hairline',
    text: 'text-body',
    emoji: '',
  };
}

// ── Score bar component ────────────────────────────────────────────────────

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-muted w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>
      <span className="font-mono text-body w-8 text-right">{Math.round(score)}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function ResultsView({ snapshot }: ResultsViewProps) {
  const [copied, setCopied] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { room, participants } = snapshot;

  const rankings = useMemo(() => computeRankings(snapshot), [snapshot]);

  function handleShare() {
    const lines = [
      `🏏 ${room.room_name} — Auction Results\n`,
      ...rankings.map((r) => {
        const medal = r.rank <= 3 ? MEDAL_STYLES[r.rank]?.emoji + ' ' : '';
        return [
          `${medal}#${r.rank} ${r.participant.squad_name} (${r.participant.display_name}) — Score: ${Math.round(r.totalScore)}`,
          `  Spent: ${formatPrice(r.totalSpent)} | Remaining: ${formatPrice(r.participant.remaining_budget_lakhs)} | Players: ${r.players.length}`,
          `  Roster: ${
            r.players
              .map(
                (sp) =>
                  `${sp.player.player_name} (${formatPrice(sp.sold_price_lakhs || 0)})`
              )
              .join(', ') || 'None'
          }`,
        ].join('\n');
      }),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const winner = rankings[0];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-slide-up">
      {/* ── Winner Banner ──────────────────────────────── */}
      {winner && winner.players.length > 0 && (
        <div className="relative mb-8 rounded-xl overflow-hidden border border-amber/30 bg-gradient-to-br from-amber/10 via-surface to-surface-raised p-6 text-center">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,197,66,0.08),transparent_70%)]" />
          <div className="relative">
            <p className="text-5xl mb-2">🏆</p>
            <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-amber">
              {winner.participant.squad_name}
            </h2>
            <p className="text-body text-sm mt-1">
              {winner.participant.display_name} — Winner
            </p>
            <div className="mt-3 inline-flex items-center gap-4 px-4 py-2 rounded-lg bg-surface/60 border border-hairline text-xs">
              <span className="font-mono text-amber font-semibold">
                Score: {Math.round(winner.totalScore)}
              </span>
              <span className="text-hairline-strong">|</span>
              <span className="text-body">
                {winner.players.length} players
              </span>
              <span className="text-hairline-strong">|</span>
              <span className="text-body">
                Spent {formatPrice(winner.totalSpent)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Header (when no winner) ────────────────────── */}
      {(!winner || winner.players.length === 0) && (
        <div className="text-center mb-8">
          <p className="text-5xl mb-3">🏏</p>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em] text-chalk">
            Auction complete.
          </h2>
          <p className="text-body mt-2">{room.room_name}</p>
        </div>
      )}

      {/* ── Actions ────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button onClick={handleShare} className="btn-outline">
          {copied ? '✓ Copied!' : '📋 Share Results'}
        </button>
        <Link href="/" className="btn-primary">
          Exit to Home
        </Link>
      </div>

      {/* ── Ranking Cards ──────────────────────────────── */}
      <div className="space-y-4">
        {rankings.map((r) => {
          const style = getRankStyle(r.rank);
          const isExpanded = expandedId === r.participant.id;

          // Group players by role for the composition view
          const roleGroups: Record<string, (RoomPlayer & { player: Player })[]> = {};
          for (const sp of r.players) {
            const role = sp.player.player_expert_in;
            if (!roleGroups[role]) roleGroups[role] = [];
            roleGroups[role].push(sp);
          }

          return (
            <div
              key={r.participant.id}
              className={`rounded-xl border ${style.border} bg-surface overflow-hidden transition-all duration-300 ${
                r.rank === 1 ? 'ring-1 ring-amber/20' : ''
              }`}
            >
              {/* ── Card Header ── */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : r.participant.id)}
                className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-surface-raised/50 transition-colors"
              >
                {/* Rank badge */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${style.bg} ${style.text} border ${style.border}`}
                >
                  {style.emoji || `#${r.rank}`}
                </div>

                {/* Name + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold text-chalk truncate">
                      {r.participant.squad_name}
                    </h3>
                    {r.participant.user_id === room.admin_user_id && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-link/15 text-link tracking-wide shrink-0">
                        ADMIN
                      </span>
                    )}
                    {r.rank === 1 && r.players.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber/15 text-amber tracking-wide shrink-0">
                        WINNER
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted truncate">
                    {r.participant.display_name}
                  </p>
                </div>

                {/* Score */}
                <div className="text-right shrink-0">
                  <p className={`font-mono text-lg font-bold ${r.rank <= 3 ? style.text : 'text-chalk'}`}>
                    {Math.round(r.totalScore)}
                  </p>
                  <p className="text-[10px] text-muted">Score</p>
                </div>

                {/* Stats pills */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <div className="px-2 py-1 rounded bg-surface-raised border border-hairline text-center">
                    <p className="font-mono text-xs font-semibold text-chalk">
                      {r.players.length}
                    </p>
                    <p className="text-[9px] text-muted">Players</p>
                  </div>
                  <div className="px-2 py-1 rounded bg-surface-raised border border-hairline text-center">
                    <p className="font-mono text-xs font-semibold text-chalk">
                      {formatPrice(r.totalSpent)}
                    </p>
                    <p className="text-[9px] text-muted">Spent</p>
                  </div>
                  <div className="px-2 py-1 rounded bg-surface-raised border border-hairline text-center">
                    <p className="font-mono text-xs font-semibold text-chalk">
                      {formatPrice(r.participant.remaining_budget_lakhs)}
                    </p>
                    <p className="text-[9px] text-muted">Left</p>
                  </div>
                </div>

                {/* Expand chevron */}
                <svg
                  className={`w-4 h-4 text-muted transition-transform duration-200 shrink-0 ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* ── Expanded Details ── */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-hairline animate-fade-in">
                  {/* Score breakdown */}
                  <div className="mt-4 mb-4 space-y-2">
                    <ScoreBar label="Composition" score={r.compositionScore} color="bg-link" />
                    <ScoreBar label="Value Deals" score={r.valueScore} color="bg-success" />
                    <ScoreBar label="Star Power" score={r.starPowerScore} color="bg-amber" />
                  </div>

                  {/* Mobile stats */}
                  <div className="sm:hidden grid grid-cols-3 gap-2 mb-4 text-center">
                    <div className="bg-surface-raised rounded-md border border-hairline py-2">
                      <p className="font-mono text-sm font-semibold text-chalk">
                        {formatPrice(r.totalSpent)}
                      </p>
                      <p className="text-[10px] text-muted mt-0.5">Spent</p>
                    </div>
                    <div className="bg-surface-raised rounded-md border border-hairline py-2">
                      <p className="font-mono text-sm font-semibold text-chalk">
                        {formatPrice(r.participant.remaining_budget_lakhs)}
                      </p>
                      <p className="text-[10px] text-muted mt-0.5">Remaining</p>
                    </div>
                    <div className="bg-surface-raised rounded-md border border-hairline py-2">
                      <p className="font-mono text-sm font-semibold text-chalk">
                        {r.players.length}
                      </p>
                      <p className="text-[10px] text-muted mt-0.5">Players</p>
                    </div>
                  </div>

                  {/* Role composition breakdown */}
                  <div className="mb-3">
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">
                      Squad Composition
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(ROLE_LABELS).map(([role, abbr]) => {
                        const count = r.roleCounts[role] || 0;
                        if (count === 0) return null;
                        return (
                          <span
                            key={role}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-raised border border-hairline text-[10px]"
                          >
                            <span className="text-muted">{abbr}</span>
                            <span className="font-mono font-semibold text-chalk">
                              {count}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Player list grouped by role */}
                  <div className="space-y-3">
                    {Object.entries(roleGroups).map(([role, players]) => (
                      <div key={role}>
                        <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                          {role} ({players.length})
                        </p>
                        <div className="space-y-1">
                          {players.map((sp) => (
                            <div
                              key={sp.id}
                              className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-raised border border-hairline text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 bg-surface border border-hairline">
                                  <PlayerImage player={sp.player} className="w-7 h-7" initialsClassName="text-[10px]" />
                                </div>
                                <div className="min-w-0">
                                  <span className="text-body font-medium truncate block">
                                    {sp.player.player_name}
                                  </span>
                                  <span className="text-[10px] text-muted">
                                    {sp.player.team_name} · {sp.player.nationality} · {sp.player.experience_years}yr
                                  </span>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <span className="font-mono text-chalk font-semibold">
                                  {formatPrice(sp.sold_price_lakhs || 0)}
                                </span>
                                <span className="block text-[10px] text-muted">
                                  Base: {sp.player.base_price_display}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {r.players.length === 0 && (
                    <p className="text-center text-muted text-xs py-4">
                      No players won
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
