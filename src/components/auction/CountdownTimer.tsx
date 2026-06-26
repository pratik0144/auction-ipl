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

export default function CountdownTimer({
  endsAt,
  isPaused,
  timerSeconds,
  resultState,
}: CountdownTimerProps) {
  const { secondsRemaining, progress, isExpired, isUrgent } = useTimer(
    endsAt,
    isPaused
  );

  const size = 172;
  const strokeWidth = 8;
  const innerStrokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const innerRadius = radius - 14;
  const innerCircumference = 2 * Math.PI * innerRadius;

  // ---- Result mode: show SOLD/UNSOLD in the timer ring ----
  if (resultState) {
    const isSold = resultState.result === 'SOLD';
    const resultColor = isSold ? 'var(--color-success)' : 'var(--color-muted)';

    return (
      <div className="flex items-center justify-center">
        <div className="relative animate-fade-in" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
            viewBox={`0 0 ${size} ${size}`}
          >
            {/* Background ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--ring-bg)"
              strokeWidth={strokeWidth}
            />
            {/* Full result ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={resultColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={0}
              style={{ transition: 'stroke 400ms ease, stroke-dashoffset 600ms ease' }}
            />
            {/* Inner glow ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={innerRadius}
              fill="none"
              stroke={resultColor}
              strokeWidth={innerStrokeWidth}
              strokeDasharray={innerCircumference}
              strokeDashoffset={0}
              opacity={0.3}
              style={{
                animation: isSold ? 'pulse-ring 1.5s ease-in-out infinite' : 'none',
              }}
            />
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`font-display font-semibold leading-none ${
                isSold ? 'text-2xl text-amber-glow' : 'text-xl text-muted'
              }`}
              style={isSold ? { animation: 'result-pulse 1.5s ease-in-out infinite' } : undefined}
            >
              {isSold ? 'SOLD!' : 'UNSOLD'}
            </span>
            {isSold && resultState.price !== undefined && (
              <span className="font-mono text-sm text-success mt-1 font-semibold">
                {formatPrice(resultState.price)}
              </span>
            )}
            {isSold && resultState.squadName && (
              <span className="text-[10px] text-muted mt-0.5 max-w-[80%] truncate text-center">
                → {resultState.squadName}
              </span>
            )}
            {!isSold && (
              <span className="text-[10px] text-muted mt-1">
                No bids placed
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Normal countdown mode ----
  const offset = circumference * (1 - progress);
  const isCritical = secondsRemaining > 0 && secondsRemaining <= 5;
  const ringColor = isExpired
    ? 'var(--color-muted)'
    : isCritical
    ? 'var(--color-danger)'
    : isUrgent
    ? 'var(--color-amber-glow)'
    : 'var(--color-amber)';
  const innerRingColor = isCritical
    ? 'var(--color-danger)'
    : isUrgent
    ? 'var(--color-amber-glow)'
    : 'var(--color-amber)';
  const innerRingOpacity = isUrgent || isCritical ? 0.6 : 0.2;

  // Display text
  let displayText = String(secondsRemaining);
  let displaySubtext = '';
  if (isPaused) {
    displayText = '⏸';
    displaySubtext = 'PAUSED';
  } else if (isExpired) {
    displayText = '⏰';
    displaySubtext = "TIME'S UP";
  }

  return (
    <div className="flex items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--ring-bg)"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={isPaused ? 0 : offset}
            style={{ transition: 'stroke 300ms ease' }}
          />
          {/* Inner ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={innerRadius}
            fill="none"
            stroke={innerRingColor}
            strokeWidth={innerStrokeWidth}
            strokeDasharray={innerCircumference}
            strokeDashoffset={0}
            style={{
              transition: 'stroke 300ms ease, opacity 300ms ease',
              opacity: innerRingOpacity,
              animation: isUrgent || isCritical
                ? 'pulse-ring 1s ease-in-out infinite'
                : 'none',
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-display font-semibold leading-none tracking-[-0.02em] ${
              isPaused || isExpired ? 'text-3xl' : 'text-4xl'
            } ${isCritical ? 'text-danger' : isUrgent ? 'text-amber-glow' : 'text-chalk'}`}
          >
            {displayText}
          </span>
          {displaySubtext && (
            <span className="text-xs text-muted mt-1 font-semibold tracking-wider">
              {displaySubtext}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
