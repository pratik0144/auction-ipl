'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 relative overflow-hidden">
      {/* Brand mesh gradient — hero-scale atmospheric backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="mesh-gradient animate-mesh-drift absolute -top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[680px] rounded-full opacity-40 blur-[80px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-void/40 to-void" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-7 animate-fade-in">
        {/* Mono eyebrow — the platform voice */}
        <span className="eyebrow">IPL Edition · Live Auction</span>

        {/* Heading — display-xl, sentence-case, negative tracking, weight 600 */}
        <div className="text-center">
          <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-[-0.04em] text-chalk leading-[1.05]">
            Build your dream XI.
          </h1>
          <p className="mt-4 text-lg text-body max-w-md mx-auto leading-relaxed">
            Bid, bluff, and out-strategise your crew in a live cricket auction.
          </p>
        </div>

        {/* CTA row — black/white pill primary + hairline secondary */}
        <div className="flex flex-col sm:flex-row gap-3 mt-2">
          <Link href="/create" className="btn-primary px-7 py-3">
            Create Room
          </Link>
          <Link href="/join" className="btn-outline px-7 py-3">
            Join Room
          </Link>
        </div>

        {/* Fine print */}
        <p className="text-sm text-muted mt-6">
          3–5 players · ~100 real cricketers · no signup
        </p>
      </div>
    </div>
  );
}
