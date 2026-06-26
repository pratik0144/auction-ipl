# 📝 Changelog

All notable changes to the **11Auction** project are documented in this file.

---

## [1.1.0] - 2026-06-26

This release implements major UI/UX improvements, viewport optimizations, layout fixes, and bids handling refactoring.

### Added
* **Centered Bids Timeline (`src/components/auction/BidHistory.tsx`):**
  * Replaced the standard vertical scrolling list of bids with a horizontal, centered timeline showing at most the 5 latest bids.
  * The newest/highest bid is highlighted in the center, and previous bids shift left/right.
  * Empty slots render invisible placeholders (`w-20` divs) to prevent layout shifting.
* **Inline Resolution Indicator (`src/components/auction/CountdownTimer.tsx`):**
  * Relocated the auction resolution overlay into the center of the countdown timer circle.
  * Renders `SOLD!` with the winning squad name and final price (pulsing green), or `UNSOLD` (faded gray).
* **Dynamic Increment Matrix (`src/lib/bidCalculator.ts`):**
  * Added a dynamic multiplier calculator that maps base prices to four distinct budget tiers (Budget, Mid, Premium, Marquee).
  * Automatically rounds increments based on size ranges ($<100\text{L} \rightarrow 5\text{L}$, $<500\text{L} \rightarrow 10\text{L}$, $<1000\text{L} \rightarrow 25\text{L}$, $\ge 1000\text{L} \rightarrow 50\text{L}$).
  * Added fallback and emergency logic to guarantee up to 4 valid ascending bidding options within a participant's budget.
* **Custom Styling and Animations (`src/app/globals.css`):**
  * Created the `animate-chip-enter` animation (combining keyframe scale-up and border flash) for new bids.
  * Integrated the `pulse-ring` and `result-pulse` keyframe loops to draw attention to timer alerts ($\le 10$ seconds left) and resolution states.

### Fixed
* **Dev Server Exit Bug:** Resolved an issue where the Next.js dev server would terminate immediately back to the shell after launching, causing connection errors on localhost:3000.
* **Zero-Scroll Viewport Lock:**
  * Added `h-screen overflow-hidden` to `src/app/room/[id]/page.tsx` to lock layouts within the device screen.
  * Configured middle column components in `src/components/auction/AuctionView.tsx` with `shrink-0` and `min-h-0` parameters to prevent layout shifting.
  * Configured scroll bars (`overflow-y-auto`) exclusively inside panels (`ChatPanel.tsx` and `TeamsPanel.tsx`).
* **Timer Size Consistency:** Standardized the countdown timer size to `172px` (reduced from `200px`) in `src/components/auction/CountdownTimer.tsx` and `src/components/auction/AuctionView.tsx` to fit smaller screens.

### Removed
* **Light Mode Support:** Completely removed light mode overrides, provider contexts, and toggle buttons due to visual bugs.
  * Removed `ThemeProvider` wrapper and `ThemeToggle` component from `src/app/layout.tsx`.
  * Removed `.light` styles and custom shadow variables from `src/app/globals.css`.
  * Removed padding spacers (`pr-11` offset) from `src/app/room/[id]/page.tsx`.
* **Full-Screen Overlays:** Deprecated the full-screen `SoldMoment` overlay component (`src/components/auction/SoldMoment.tsx`) to prevent screen-blocking interruptions.

---

## [1.0.0] - 2026-06-25

This release marks the initial stable launch of the real-time IPL Auction scaffold.

### Added
* **Database Scaffold:**
  * Schema creation (`supabase/migrations/001_schema.sql`): core tables for `rooms`, `players`, `room_participants`, `room_players`, and `bids`.
  * Security policies (`supabase/migrations/002_rls_policies.sql`): configured Row-Level Security parameters.
  * Procedures and functions (`supabase/migrations/003_functions.sql`): security definer functions for transactions (`start_auction`, `place_bid`, `check_and_resolve`, etc.).
  * Sweeper cron (`supabase/migrations/004_cron.sql`): runs `resolve_expired_auctions()` every 60 seconds to resolve abandoned rooms.
* **Seed Catalog (`supabase/seed.sql`):** Populated database with ~100 IPL players, expertises, countries, and base prices.
* **Realtime Sync System (`src/lib/supabase/realtime.ts`):** Client-side listener wrappers using Supabase subscriptions to catch update, insert, and delete logs on room tables.
* **Client Service Wrappers (`src/lib/api.ts`):** Client-side API functions for joining, bidding, pausing, resuming, skipping, and fetching room snapshots.
* **Lobby & Core Views:**
  * Create room lobby interface (`src/app/create/page.tsx`).
  * Room join validator (`src/app/join/page.tsx`).
  * Live auction multiplayer screen (`src/app/room/[id]/page.tsx` & `src/components/auction/AuctionView.tsx`).
  * Post-auction squad results display (`src/components/results/ResultsView.tsx`).
* **Custom Hooks:** Custom animation frame calculation hook (`src/hooks/useTimer.ts`) with clock offset calibration.
* **Local Dev Testing Bypass:** Added `start_auction_dev` RPC database functions allowing developers to bypass the 3-participant limit in local development (`npm run dev:test`).
