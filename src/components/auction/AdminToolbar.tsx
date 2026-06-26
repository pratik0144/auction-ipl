'use client';

import { useState } from 'react';
import type { RoomStatus } from '@/lib/types';
import {
  pauseAuction,
  resumeAuction,
  forceResolveCurrentPlayer,
  endAuctionEarly,
} from '@/lib/api';

interface AdminToolbarProps {
  roomId: string;
  adminUserId: string;
  roomStatus: RoomStatus;
}

export default function AdminToolbar({
  roomId,
  adminUserId,
  roomStatus,
}: AdminToolbarProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const isPaused = roomStatus === 'PAUSED';

  async function handlePauseResume() {
    setLoading('pause');
    if (isPaused) {
      await resumeAuction({ room_id: roomId, admin_user_id: adminUserId });
    } else {
      await pauseAuction({ room_id: roomId, admin_user_id: adminUserId });
    }
    setLoading(null);
  }

  async function handleSkip() {
    setLoading('skip');
    await forceResolveCurrentPlayer({
      room_id: roomId,
      admin_user_id: adminUserId,
    });
    setLoading(null);
  }

  async function handleEnd() {
    if (!confirm('End the auction early? All remaining players will be unsold.')) {
      return;
    }
    setLoading('end');
    await endAuctionEarly({ room_id: roomId, admin_user_id: adminUserId });
    setLoading(null);
  }

  return (
    <div className="flex items-center gap-1.5 pl-3 ml-1 border-l border-hairline">
      <span className="eyebrow text-[10px] mr-1 hidden md:inline">Admin</span>
      <button
        onClick={handlePauseResume}
        disabled={loading !== null}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-colors bg-surface-raised border border-hairline hover:border-hairline-strong text-chalk disabled:opacity-40"
        title={isPaused ? 'Resume auction' : 'Pause auction'}
      >
        <span>{isPaused ? '▶' : '⏸'}</span>
        <span className="hidden lg:inline">
          {loading === 'pause' ? '…' : isPaused ? 'Resume' : 'Pause'}
        </span>
      </button>
      <button
        onClick={handleSkip}
        disabled={loading !== null || isPaused}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-colors bg-surface-raised border border-hairline hover:border-hairline-strong text-chalk disabled:opacity-40"
        title="Skip current player"
      >
        <span>⏭</span>
        <span className="hidden lg:inline">
          {loading === 'skip' ? '…' : 'Skip'}
        </span>
      </button>
      <button
        onClick={handleEnd}
        disabled={loading !== null}
        className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-colors bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 disabled:opacity-40"
        title="End auction early"
      >
        <span>🛑</span>
        <span className="hidden lg:inline">
          {loading === 'end' ? '…' : 'End'}
        </span>
      </button>
    </div>
  );
}
