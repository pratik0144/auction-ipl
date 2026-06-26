'use client';

import { use } from 'react';
import { useRoom } from '@/hooks/useRoom';
import { useLocalUser } from '@/hooks/useLocalUser';
import { useParticipant } from '@/hooks/useParticipant';
import LobbyView from '@/components/lobby/LobbyView';
import AuctionView from '@/components/auction/AuctionView';
import ResultsView from '@/components/results/ResultsView';
import AdminToolbar from '@/components/auction/AdminToolbar';
import Link from 'next/link';

export default function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { userId } = useLocalUser();
  const { snapshot, loading, error } = useRoom(id);
  const { participant, isAdmin, myPlayers } = useParticipant(snapshot, userId);

  // Loading skeleton
  if (loading || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-full skeleton" />
          <div className="w-48 h-4 skeleton" />
          <div className="w-32 h-3 skeleton" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !snapshot) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center animate-fade-in">
          <p className="text-3xl mb-3">😕</p>
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] mb-2">
            Room not found
          </h2>
          <p className="text-muted text-sm mb-4">
            {error || 'This room doesn\'t exist or you don\'t have access.'}
          </p>
          <Link href="/" className="btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Not a participant — show a message
  if (!participant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-md text-center animate-fade-in">
          <p className="text-3xl mb-3">🔒</p>
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em] mb-2">
            Not a participant
          </h2>
          <p className="text-muted text-sm mb-4">
            You haven&apos;t joined this room yet.
          </p>
          <Link
            href={`/join/${snapshot.room.room_code}`}
            className="btn-primary"
          >
            Join Room
          </Link>
        </div>
      </div>
    );
  }

  // Top bar
  const topBar = (
    <div className="h-14 px-6 flex items-center justify-between border-b border-hairline shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-lg">🏏</span>
        <h1 className="font-display font-semibold tracking-[-0.02em] truncate">
          {snapshot.room.room_name}
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-body tracking-wide">
          {snapshot.room.room_code}
        </span>
        <StatusBadge status={snapshot.room.status} />
        {/* Admin controls — admin-only, live auction only, distinct from status */}
        {isAdmin &&
          (snapshot.room.status === 'AUCTION' ||
            snapshot.room.status === 'PAUSED') && (
            <AdminToolbar
              roomId={snapshot.room.id}
              adminUserId={participant.user_id}
              roomStatus={snapshot.room.status}
            />
          )}
      </div>
    </div>
  );

  // Render by room status
  const status = snapshot.room.status;

  if (status === 'LOBBY') {
    return (
      <div className="min-h-screen flex flex-col">
        {topBar}
        <div className="flex-1">
          <LobbyView
            snapshot={snapshot}
            participant={participant}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    );
  }

  if (status === 'AUCTION' || status === 'PAUSED') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        {topBar}
        <div className="flex-1 overflow-hidden">
          <AuctionView
            snapshot={snapshot}
            participant={participant}
            isAdmin={isAdmin}
            userId={userId}
            myPlayers={myPlayers}
          />
        </div>
      </div>
    );
  }

  if (status === 'COMPLETED') {
    return (
      <div className="min-h-screen flex flex-col">
        {topBar}
        <div className="flex-1">
          <ResultsView snapshot={snapshot} />
        </div>
      </div>
    );
  }

  return null;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    LOBBY: { label: 'Lobby', color: 'bg-surface-raised text-body border border-hairline' },
    AUCTION: { label: 'Live', color: 'bg-amber/15 text-amber border border-amber/30' },
    PAUSED: { label: 'Paused', color: 'bg-surface-raised text-muted border border-hairline' },
    COMPLETED: { label: 'Completed', color: 'bg-success/15 text-success border border-success/30' },
  };
  const c = config[status] || config.LOBBY;
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.color}`}
    >
      {c.label}
    </span>
  );
}
