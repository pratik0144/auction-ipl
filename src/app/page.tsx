'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Brand mesh gradient — hero-scale atmospheric backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="mesh-gradient animate-mesh-drift absolute -top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[680px] rounded-full opacity-40 blur-[80px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-void/60 to-void" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* ---- Hero ---- */}
        <section className="flex flex-col items-center text-center px-6 pt-28 pb-16 gap-7 animate-fade-in">
          <span className="eyebrow">IPL Edition · Live Auction</span>
          <div>
            <h1 className="font-display text-5xl sm:text-6xl font-semibold tracking-[-0.04em] text-chalk leading-[1.05]">
              Build your dream XI.
            </h1>
            <p className="mt-4 text-lg text-body max-w-md mx-auto leading-relaxed">
              Bid, bluff, and out-strategise your crew in a live cricket auction.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-1">
            <Link href="/create" className="btn-primary px-7 py-3">
              Create Room
            </Link>
            <Link href="/join" className="btn-outline px-7 py-3">
              Join Room
            </Link>
          </div>
        </section>

        {/* ---- Tournament selector ---- */}
        <section className="w-full max-w-5xl px-6 pb-28">
          <div className="flex items-center gap-4 mb-6">
            <span className="eyebrow">Tournaments</span>
            <div className="h-px flex-1 bg-hairline" />
            <span className="eyebrow">01</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* IPL — the selectable tournament */}
            <Link
              href="/rooms"
              className="group card relative flex flex-col min-h-[210px] hover:border-hairline-strong transition-colors"
            >
              <div className="flex items-start justify-between">
                <span className="eyebrow">No 01 / Cricket</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber/40 text-amber uppercase tracking-wider">
                  New
                </span>
              </div>

              <div className="mt-auto pt-8">
                <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-chalk">
                  IPL 2026
                </h3>
                <p className="font-mono text-xs text-muted mt-1">Mar – May 2026</p>
              </div>

              <div className="h-px bg-hairline my-4" />

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30 uppercase tracking-wider">
                  Open
                </span>
                <span className="text-body group-hover:text-chalk group-hover:translate-x-0.5 transition-all">
                  →
                </span>
              </div>
              <p className="text-sm text-muted mt-3">
                Live player auction · build your XI
              </p>
            </Link>

            {/* Coming soon — visual parity, disabled */}
            <div className="card relative flex flex-col min-h-[210px] opacity-55">
              <div className="flex items-start justify-between">
                <span className="eyebrow">No 02 / —</span>
              </div>
              <div className="mt-auto pt-8">
                <h3 className="font-display text-2xl font-semibold tracking-[-0.02em] text-muted">
                  More leagues
                </h3>
                <p className="font-mono text-xs text-muted mt-1">Coming soon</p>
              </div>
              <div className="h-px bg-hairline my-4" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-raised text-muted border border-hairline uppercase tracking-wider">
                  Soon
                </span>
              </div>
              <p className="text-sm text-muted mt-3">Football, Kabaddi & more.</p>
            </div>
          </div>

          <p className="text-center text-xs text-muted mt-10">
            3–5 players · ~100 real cricketers · no signup
          </p>
        </section>
      </div>
    </div>
  );
}
