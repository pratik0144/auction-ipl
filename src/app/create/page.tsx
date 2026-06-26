'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createRoom } from '@/lib/api';
import { useLocalUser } from '@/hooks/useLocalUser';
import { formatPrice } from '@/lib/utils';

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export default function CreateRoomPage() {
  const router = useRouter();
  const { userId, setParticipant } = useLocalUser();

  const [roomName, setRoomName] = useState(IS_DEV ? 'Dev Test Room' : '');
  const [purseBudget, setPurseBudget] = useState(12000);
  const [maxSquad, setMaxSquad] = useState(18);
  const [timerDuration, setTimerDuration] = useState(30);
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-slide-up">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted hover:text-chalk transition-colors mb-6"
        >
          ← Back
        </Link>

        <div className="card">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] mb-1">Create Room</h1>
          <p className="text-muted text-sm mb-6">
            Set up your auction and invite friends.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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

            {/* Purse Budget */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-body">
                Purse Budget per Player
              </span>
              <div className="relative">
                <input
                  type="number"
                  value={purseBudget}
                  onChange={(e) => setPurseBudget(Number(e.target.value))}
                  min={1000}
                  max={50000}
                  step={500}
                  className="w-full px-3 py-2.5 bg-surface border border-hairline rounded-md text-chalk focus:outline-none focus:border-link focus:ring-1 focus:ring-link/40 transition-colors"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  {formatPrice(purseBudget)}
                </span>
              </div>
            </label>

            {/* Max Squad Size */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-body">
                Max Squad Size
              </span>
              <input
                type="number"
                value={maxSquad}
                onChange={(e) => setMaxSquad(Number(e.target.value))}
                min={5}
                max={25}
                className="w-full px-3 py-2.5 bg-surface border border-hairline rounded-md text-chalk focus:outline-none focus:border-link focus:ring-1 focus:ring-link/40 transition-colors"
              />
            </label>

            {/* Timer Duration */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-body">
                Bid Timer (seconds)
              </span>
              <input
                type="number"
                value={timerDuration}
                onChange={(e) => setTimerDuration(Number(e.target.value))}
                min={10}
                max={120}
                step={5}
                className="w-full px-3 py-2.5 bg-surface border border-hairline rounded-md text-chalk focus:outline-none focus:border-link focus:ring-1 focus:ring-link/40 transition-colors"
              />
            </label>

            {error && (
              <p className="text-danger text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !userId}
              className="btn-primary w-full mt-2"
            >
              {loading ? 'Creating…' : 'Create Room'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
