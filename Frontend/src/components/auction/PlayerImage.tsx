'use client';

import { useState } from 'react';
import type { Player } from '@/lib/types';

interface PlayerImageProps {
  player: Pick<Player, 'player_name' | 'player_img_url'>;
  /** Sizing + shape classes — applied to BOTH the image and the fallback. */
  className?: string;
  /** Class for the fallback initials text (size etc.). */
  initialsClassName?: string;
}

/**
 * Player headshot. Renders the real `player_img_url`; on load error (or when
 * missing) falls back to an initials avatar — never a broken-image icon.
 */
export default function PlayerImage({
  player,
  className = '',
  initialsClassName = 'text-xl',
}: PlayerImageProps) {
  const [failed, setFailed] = useState(false);

  const initials = player.player_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (failed || !player.player_img_url) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <span className={`font-display font-semibold text-link ${initialsClassName}`}>
          {initials}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={player.player_img_url}
      alt={player.player_name}
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
