'use client';

import { useEffect, useState } from 'react';
import { formatPrice } from '@/lib/utils';

interface SoldMomentProps {
  result: 'SOLD' | 'UNSOLD';
  playerName: string;
  squadName?: string;
  price?: number;
  onDismiss: () => void;
}

export default function SoldMoment({
  result,
  playerName,
  squadName,
  price,
  onDismiss,
}: SoldMomentProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400); // Wait for fade-out
    }, 2600);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const isSold = result === 'SOLD';

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-400 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      {/* Confetti for SOLD — brand mesh-gradient palette */}
      {isSold && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#007cf0', '#00dfd8', '#7928ca', '#ff0080', '#f9cb28'][
                  i % 5
                ],
                animation: `confetti-fall ${2 + Math.random() * 2}s linear ${Math.random() * 0.5}s forwards`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="text-center animate-slide-up relative z-10">
        <h2
          className={`font-display font-semibold tracking-[-0.04em] leading-none ${
            isSold
              ? 'text-7xl text-amber-glow drop-shadow-[0_0_40px_rgba(249,203,40,0.4)]'
              : 'text-5xl text-muted'
          }`}
        >
          {isSold ? 'SOLD!' : 'UNSOLD'}
        </h2>
        <p className="font-display text-xl text-chalk mt-4 tracking-[-0.02em]">{playerName}</p>
        {isSold && squadName && price !== undefined && (
          <p className="text-muted mt-2">
            to <span className="text-amber font-semibold">{squadName}</span>{' '}
            for{' '}
            <span className="font-mono text-amber font-semibold">
              {formatPrice(price)}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
