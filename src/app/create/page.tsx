'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createRoom } from '@/lib/api';
import { useLocalUser } from '@/hooks/useLocalUser';
import { useAuth } from '@/components/AuthProvider';
import type { PlayerOrder } from '@/lib/types';

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

const PURSE_OPTIONS = [
  { label: '₹100 Cr', lakhs: 10000 },
  { label: '₹150 Cr', lakhs: 15000 },
  { label: '₹200 Cr', lakhs: 20000 },
  { label: '₹250 Cr', lakhs: 25000 },
];
const SQUAD_OPTIONS = [10, 15, 20, 25];
const TIMER_OPTIONS = [10, 15, 20, 25, 30];

/** Segmented selector — a row of mutually-exclusive option buttons. */
function Segmented<T>({
  options,
  value,
  onChange,
  cols,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  cols: string;
}) {
  return (
    <div className={`grid ${cols} gap-2`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`h-10 rounded-md border text-sm font-medium transition-colors ${
              active
                ? 'bg-chalk text-void border-chalk'
                : 'bg-surface text-body border-hairline hover:border-hairline-strong hover:text-chalk'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CreateRoomPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userId, setParticipant } = useLocalUser();

  const [roomName, setRoomName] = useState(IS_DEV ? 'Dev Test Room' : '');
  const [purseBudget, setPurseBudget] = useState(15000); // lakhs (₹150 Cr)
  const [maxSquad, setMaxSquad] = useState(15);
  const [timerDuration, setTimerDuration] = useState(30);
  const [playerOrder, setPlayerOrder] = useState<PlayerOrder>('CATEGORY');
  const [isPublic, setIsPublic] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomName.trim()) {
      setError('Room name is required');
      return;
    }
    if (!userId) return;

    setLoading(true);
    setError(null);

    const result = await createRoom({
      room_name: roomName.trim(),
      admin_user_id: userId,
      purse_budget_lakhs: purseBudget,
      max_squad_size: maxSquad,
      bid_timer_seconds: timerDuration,
      is_public: isPublic,
      player_order: playerOrder,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.data) {
      setParticipant(result.data.participant_id, result.data.id);
      router.push(`/room/${result.data.id}`);
    }
  }

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth');
    }
  }, [authLoading, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-2 text-muted hover:text-chalk transition-colors mb-6"
        >
          ← Back
        </Link>

        <div className="card">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] mb-1">
            Create Room
          </h1>
          <p className="text-muted text-sm mb-6">
            Set up your IPL auction and invite friends.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* Room Name */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-body">Room Name</span>
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="e.g. IPL Mega Auction"
                className="w-full px-3 py-2.5 bg-surface border border-hairline rounded-md text-chalk placeholder:text-muted focus:outline-none focus:border-link focus:ring-1 focus:ring-link/40 transition-colors"
                required
              />
            </label>

            {/* Purse */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-body">Purse Budget</span>
              <Segmented
                cols="grid-cols-4"
                value={purseBudget}
                onChange={setPurseBudget}
                options={PURSE_OPTIONS.map((o) => ({ label: o.label, value: o.lakhs }))}
              />
            </div>

            {/* Squad Size */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-body">Max Squad Size</span>
              <Segmented
                cols="grid-cols-4"
                value={maxSquad}
                onChange={setMaxSquad}
                options={SQUAD_OPTIONS.map((n) => ({ label: String(n), value: n }))}
              />
            </div>

            {/* Timer */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-body">Bid Timer</span>
              <Segmented
                cols="grid-cols-5"
                value={timerDuration}
                onChange={setTimerDuration}
                options={TIMER_OPTIONS.map((n) => ({ label: `${n}s`, value: n }))}
              />
            </div>

            {/* Player Order */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-body">Player Order</span>
              <Segmented
                cols="grid-cols-2"
                value={playerOrder}
                onChange={setPlayerOrder}
                options={[
                  { label: 'Random', value: 'RANDOM' },
                  { label: 'By Category', value: 'CATEGORY' },
                ]}
              />
              <p className="text-xs text-muted">
                {playerOrder === 'CATEGORY'
                  ? 'Stars & key players sprinkled through the auction for a livelier flow.'
                  : 'Pure random shuffle of all players.'}
              </p>
            </div>

            {/* Visibility */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-body">Visibility</span>
              <Segmented
                cols="grid-cols-2"
                value={isPublic}
                onChange={setIsPublic}
                options={[
                  { label: 'Public', value: true },
                  { label: 'Private', value: false },
                ]}
              />
              <p className="text-xs text-muted">
                {isPublic
                  ? 'Listed in Public Rooms — anyone can find and join.'
                  : 'Hidden — only people with your invite link can join.'}
              </p>
            </div>

            {error && <p className="text-danger text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading || !userId}
              className="btn-primary w-full mt-1"
            >
              {loading ? 'Creating…' : 'Create Room'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
