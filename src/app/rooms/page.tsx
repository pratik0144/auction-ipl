'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useLocalUser } from '@/hooks/useLocalUser';
import {
  listPublicRooms,
  listMyRooms,
  type PublicRoomSummary,
  type MyRoomSummary,
} from '@/lib/api';
import type { RoomStatus } from '@/lib/types';

function StatusPill({ status }: { status: RoomStatus }) {
  const map: Record<RoomStatus, { label: string; cls: string }> = {
    LOBBY: { label: 'Waiting', cls: 'bg-surface-raised text-muted border-hairline' },
    AUCTION: { label: 'Live', cls: 'bg-amber/15 text-amber border-amber/30' },
    PAUSED: { label: 'Paused', cls: 'bg-surface-raised text-muted border-hairline' },
    COMPLETED: { label: 'Done', cls: 'bg-success/15 text-success border-success/30' },
  };
  const c = map[status] ?? map.LOBBY;
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${c.cls}`}
    >
      {c.label}
    </span>
  );
}

export default function RoomsPage() {
  const { userId } = useLocalUser();
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[] | null>(null);
  const [myRooms, setMyRooms] = useState<MyRoomSummary[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadPublic = useCallback(async () => {
    const res = await listPublicRooms();
    if (res.data) setPublicRooms(res.data);
  }, []);

  const loadMine = useCallback(async () => {
    if (!userId) return;
    const res = await listMyRooms(userId);
    if (res.data) setMyRooms(res.data);
  }, [userId]);

  useEffect(() => {
    loadPublic();
  }, [loadPublic]);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  // Keep the public list reasonably fresh.
  useEffect(() => {
    const id = setInterval(loadPublic, 8000);
    return () => clearInterval(id);
  }, [loadPublic]);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadPublic(), loadMine()]);
    setRefreshing(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ---- Header ---- */}
      <header className="h-16 px-6 flex items-center justify-between border-b border-hairline shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-display font-semibold tracking-[-0.02em] text-chalk">
            🏏 11auction
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 h-9 px-3 rounded-md bg-surface border border-hairline hover:border-hairline-strong transition-colors"
            title="Change tournament"
          >
            <span className="eyebrow text-[10px]">No 01</span>
            <span className="text-sm font-medium text-chalk">IPL 2026</span>
            <span className="text-muted text-xs">▾</span>
          </Link>
        </div>
        <button
          onClick={handleRefresh}
          className="text-sm text-body hover:text-chalk transition-colors"
          title="Refresh"
        >
          {refreshing ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-6 py-10 animate-fade-in">
        {/* Context line */}
        <div className="flex flex-col items-center text-center gap-1 mb-8">
          <span className="eyebrow">IPL 2026 · Player Auction</span>
          <p className="text-sm text-muted">
            Create a room and invite your crew, or join an open one below.
          </p>
        </div>

        {/* ---- Primary actions ---- */}
        <div className="card-raised">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 uppercase tracking-wider">
              Open
            </span>
            <span className="text-sm text-body">~100 real cricketers in the pool</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/create"
              className="flex items-center justify-center h-12 rounded-md bg-amber text-void font-semibold hover:bg-amber-glow transition-colors"
            >
              Create Room
            </Link>
            <Link
              href="/join"
              className="flex items-center justify-center h-12 rounded-md bg-surface-raised border border-hairline text-chalk font-semibold hover:border-hairline-strong transition-colors"
            >
              Join Room
            </Link>
          </div>
        </div>

        {/* ---- Public rooms ---- */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <span className="eyebrow">Public Rooms</span>
            <span className="eyebrow text-[10px]">
              {publicRooms ? `${publicRooms.length} open` : '—'}
            </span>
          </div>

          {publicRooms === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="skeleton h-28" />
              <div className="skeleton h-28" />
            </div>
          ) : publicRooms.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-sm text-muted">
                No open rooms right now.{' '}
                <Link href="/create" className="text-amber hover:text-amber-glow">
                  Create one →
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {publicRooms.map((room) => (
                <div key={room.id} className="card flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-display font-semibold text-chalk truncate">
                      {room.room_name}
                    </h4>
                    <StatusPill status={room.status} />
                  </div>
                  <p className="text-xs text-muted mt-1">IPL 2026 · Player auction</p>
                  <div className="h-px bg-hairline my-3" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-muted">
                      {room.room_code} · {room.participant_count}{' '}
                      {room.participant_count === 1 ? 'team' : 'teams'}
                    </span>
                    <Link
                      href={`/join/${room.room_code}`}
                      className="text-amber font-medium hover:text-amber-glow transition-colors"
                    >
                      Join →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---- Your rooms ---- */}
        {myRooms && myRooms.length > 0 && (
          <section className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow">Your Rooms</span>
              <span className="eyebrow text-[10px]">{myRooms.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {myRooms.map((room) => (
                <Link
                  key={room.id}
                  href={`/room/${room.id}`}
                  className="flex items-center justify-between px-4 py-3 rounded-md bg-surface border border-hairline hover:border-hairline-strong transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-chalk truncate">{room.room_name}</p>
                    <p className="text-xs text-muted">
                      {room.squad_name} · {room.room_code}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusPill status={room.status} />
                    <span className="text-body">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
