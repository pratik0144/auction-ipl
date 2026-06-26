'use client';

import { useTimer } from '@/hooks/useTimer';
import { formatPrice } from '@/lib/utils';

interface ResultState {
  result: 'SOLD' | 'UNSOLD';
  playerName: string;
  squadName?: string;
  price?: number;
}

interface CountdownTimerProps {
  endsAt: string | null;
  isPaused: boolean;
  timerSeconds: number;
  resultState?: ResultState | null;
}

const SIZE = 172;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

export default function CountdownTimer({
  endsAt,
  isPaused,
  timerSeconds,
  resultState,
}: CountdownTimerProps) {
  const { secondsRemaining, progress, isExpired, isUrgent } = useTimer(
    endsAt,
    isPaused,
    timerSeconds
  );

  // ---- Result mode: SOLD / UNSOLD shown inside the ring ----
  if (resultState) {
    const isSold = resultState.result === 'SOLD';
    const ringColor = isSold ? 'var(--color-success)' : 'var(--color-hairline-strong)';

    return (
      <div className="flex items-center justify-center">
        <div
          className="relative animate-fade-in"
          style={{ width: SIZE, height: SIZE }}
        >
          <svg width={SIZE} height={SIZE} className="-rotate-90" viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--color-hairline)"
              strokeWidth={STROKE}
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={0}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`font-mono text-xl font-semibold tracking-[0.12em] ${
                isSold ? 'text-success' : 'text-muted'
              }`}
            >
              {isSold ? 'SOLD' : 'UNSOLD'}
            </span>
            {isSold && resultState.price !== undefined ? (
              <span className="font-mono text-sm text-chalk mt-1.5 font-medium">
                {formatPrice(resultState.price)}
              </span>
            ) : (
              <span className="text-[10px] text-muted mt-1.5 font-mono uppercase tracking-[0.15em]">
                No bids
              </span>
            )}
            {isSold && resultState.squadName && (
              <span className="text-[10px] text-muted mt-0.5 max-w-[80%] truncate text-center">
                {resultState.squadName}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Countdown mode ----
  const isCritical = secondsRemaining > 0 && secondsRemaining <= 5;
  const offset = CIRC * (1 - progress);

  // Single, restrained color ramp: ink-white → amber (≤10s) → red (≤5s).
  const activeColor = isCritical
    ? 'var(--color-danger)'
    : isUrgent
    ? 'var(--color-amber)'
    : 'var(--color-chalk)';
  const ringColor = isPaused || isExpired ? 'var(--color-hairline-strong)' : activeColor;

  const displayNumber = isExpired ? 0 : secondsRemaining;
  const caption = isPaused ? 'Paused' : isExpired ? "Time's up" : 'Seconds';
  const numberColor = isPaused || isExpired ? 'text-muted' : '';

  return (
    <div className="flex items-center justify-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90" viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Track */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-hairline)"
            strokeWidth={STROKE}
          />
          {/* Progress — offset is RAF-driven (smooth); only color transitions */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={isPaused ? CIRC * (1 - progress) : offset}
            style={{ transition: 'stroke 400ms ease' }}
          />
        </svg>

        {/* Center readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-mono tabular-nums leading-none font-semibold tracking-[-0.02em] ${
              isPaused || isExpired ? 'text-4xl' : 'text-5xl'
            } ${numberColor}`}
            style={numberColor ? undefined : { color: activeColor }}
          >
            {displayNumber}
          </span>
          <span className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            {caption}
          </span>
        </div>
      </div>
    </div>
  );
}
