'use client';

import { useState } from 'react';
import type { RoomSnapshot, RoomParticipant } from '@/lib/types';
import { startAuction } from '@/lib/api';

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
import { formatPrice } from '@/lib/utils';

interface LobbyViewProps {
  snapshot: RoomSnapshot;
  participant: RoomParticipant;
  isAdmin: boolean;
}

export default function LobbyView({
  snapshot,
  participant,
  isAdmin,
}: LobbyViewProps) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { room, participants } = snapshot;
  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/join/${room.room_code}`
      : '';

  async function handleStart() {
    setStarting(true);
    setError(null);
    const result = await startAuction({
      room_id: room.id,
      admin_user_id: participant.user_id,
    });
    if (result.error) {
      setError(result.error);
      setStarting(false);
    }
    // Room status will update via realtime — no need to navigate
  }

  function copyCode() {
    navigator.clipboard.writeText(shareUrl || room.room_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-56px)] px-4">
      <div className="w-full max-w-lg animate-slide-up">
        {/* Room Code */}
        <div className="text-center mb-8">
          <p className="eyebrow mb-3">Room Code</p>
          <button
            onClick={copyCode}
            className="group inline-flex items-center gap-3"
            title="Click to copy"
          >
            <span className="font-mono text-5xl font-semibold text-chalk tracking-[0.3em]">
              {room.room_code}
            </span>
            <span className="text-muted group-hover:text-chalk transition-colors text-lg">
              {copied ? '✓' : '📋'}
            </span>
          </button>
          {shareUrl && (
            <p className="text-sm text-muted mt-2 break-all">{shareUrl}</p>
          )}
        </div>

        {/* Room Rules */}
        <div className="card mb-6">
          <h3 className="eyebrow mb-3">
            Auction Rules
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="font-display text-xl font-semibold text-chalk">
                {formatPrice(room.purse_budget_lakhs)}
              </p>
              <p className="text-xs text-muted mt-0.5">Budget</p>
            </div>
            <div>
              <p className="font-display text-xl font-semibold text-chalk">
                {room.max_squad_size}
              </p>
              <p className="text-xs text-muted mt-0.5">Max Squad</p>
            </div>
            <div>
              <p className="font-display text-xl font-semibold text-chalk">
                {room.bid_timer_seconds}s
              </p>
              <p className="text-xs text-muted mt-0.5">Timer</p>
            </div>
          </div>
        </div>

        {/* Participants */}
        <div className="card mb-6">
          <h3 className="eyebrow mb-3">
            Participants ({participants.length}/5)
          </h3>
          <div className="flex flex-col gap-2">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-3 py-2 rounded-md bg-surface-raised border border-hairline"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-link/15 flex items-center justify-center text-sm font-display font-semibold text-link">
                    {p.display_name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-chalk">{p.squad_name}</p>
                    <p className="text-xs text-muted">{p.display_name}</p>
                  </div>
                </div>
                {p.user_id === room.admin_user_id && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-link/15 text-link uppercase tracking-wide">
                    Admin
                  </span>
                )}
              </div>
            ))}
          </div>

          {participants.length < 2 && !IS_DEV && (
            <p className="text-center text-muted text-sm mt-4">
              Share the room code to invite friends!
            </p>
          )}
        </div>

        {/* Action */}
        {error && (
          <p className="text-danger text-sm text-center mb-3">{error}</p>
        )}
        {IS_DEV && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber/10 border border-amber/30 text-amber text-xs text-center font-mono">
            🔧 DEV MODE — Solo testing enabled
          </div>
        )}

        {isAdmin ? (
          <button
            onClick={handleStart}
            disabled={starting || (!IS_DEV && participants.length < 2)}
            className="btn-primary w-full text-lg"
            title={
              !IS_DEV && participants.length < 2
                ? 'Need at least 2 participants'
                : undefined
            }
          >
            {starting ? 'Starting…' : '🚀 Start Auction'}
          </button>
        ) : (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 text-muted animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber/60" />
              Waiting for admin to start the auction…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
