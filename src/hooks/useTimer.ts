'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export function useTimer(
  endsAt: string | null,
  isPaused: boolean = false,
  totalSeconds?: number
) {
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [progress, setProgress] = useState(1);
  const rafRef = useRef<number>(0);
  const totalDurationRef = useRef<number>(30);

  const tick = useCallback(() => {
    if (!endsAt || isPaused) {
      rafRef.current = 0;
      return;
    }

    const endTime = new Date(endsAt).getTime();
    const now = Date.now();
    const remaining = Math.max(0, (endTime - now) / 1000);

    setSecondsRemaining(Math.ceil(remaining));
    setProgress(Math.min(1, remaining / totalDurationRef.current));

    if (remaining > 0) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [endsAt, isPaused]);

  useEffect(() => {
    if (!endsAt || isPaused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    // Prefer the room's actual configured timer for an accurate ring; only
    // fall back to a heuristic if no duration was provided.
    const endTime = new Date(endsAt).getTime();
    const remaining = Math.max(0, (endTime - Date.now()) / 1000);
    if (totalSeconds && totalSeconds > 0) {
      // The ring should never read as "more than full" if a bid extended the
      // window beyond the base duration — use the larger of the two.
      totalDurationRef.current = Math.max(totalSeconds, remaining);
    } else if (remaining > 25) totalDurationRef.current = 30;
    else if (remaining > 15) totalDurationRef.current = 20;
    else totalDurationRef.current = Math.max(remaining, 10);

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [endsAt, isPaused, tick, totalSeconds]);

  const isExpired = !isPaused && endsAt !== null && secondsRemaining <= 0;
  const isUrgent = secondsRemaining > 0 && secondsRemaining <= 10;

  return { secondsRemaining, progress, isExpired, isUrgent };
}
