'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { joinRoom } from '@/lib/api';
import { useLocalUser } from '@/hooks/useLocalUser';
import { useAuth } from '@/components/AuthProvider';

export default function JoinRoomPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { userId, setParticipant } = useLocalUser();

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth');
    }
  }, [authLoading, user, router]);

  const [roomCode, setRoomCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [squadName, setSquadName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomCode.trim() || !displayName.trim() || !squadName.trim()) {
      setError('All fields are required');
      return;
    }
    if (!userId) return;

    setLoading(true);
    setError(null);

    const result = await joinRoom({
      room_code: roomCode.trim().toUpperCase(),
      user_id: userId,
      display_name: displayName.trim(),
      squad_name: squadName.trim(),
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.data) {
      const data = result.data as unknown as { id: string; room_id: string };
      setParticipant(data.id, data.room_id);
      router.push(`/room/${data.room_id}`);
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
          <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] mb-1">Join Room</h1>
          <p className="text-muted text-sm mb-6">
            Enter the room code shared by your friend.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Room Code */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-body">Room Code</span>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                maxLength={6}
                className="w-full px-3 py-2.5 bg-surface border border-hairline rounded-md text-chalk font-mono text-xl tracking-widest text-center uppercase placeholder:text-muted focus:outline-none focus:border-link focus:ring-1 focus:ring-link/40 transition-colors"
                required
              />
            </label>

            {/* Display Name */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-body">
                Display Name
              </span>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full px-3 py-2.5 bg-surface border border-hairline rounded-md text-chalk placeholder:text-muted focus:outline-none focus:border-link focus:ring-1 focus:ring-link/40 transition-colors"
                required
              />
            </label>

            {/* Squad Name */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-body">
                Squad Name
              </span>
              <input
                type="text"
                value={squadName}
                onChange={(e) => setSquadName(e.target.value)}
                placeholder="e.g. Thunder XI"
                className="w-full px-3 py-2.5 bg-surface border border-hairline rounded-md text-chalk placeholder:text-muted focus:outline-none focus:border-link focus:ring-1 focus:ring-link/40 transition-colors"
                required
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
              {loading ? 'Joining…' : 'Join Room'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
