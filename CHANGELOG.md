# 📝 Changelog

All notable changes to the **11Auction** project are documented in this file.

---

## [1.3.0] - 2026-06-30

This release integrates full Supabase Email/Password Authentication, replacing the legacy anonymous localStorage UUID model. It implements client-side auth context, server-side session refreshes via middleware, route/action guards, a profile UI on the landing page, dev quick logins, and recursion-free database RLS rules.

### Added
* **Supabase Email/Password Authentication:**
  * Created a secure, toggle-style Sign In / Sign Up page at `/auth` styled with the Vercel-inspired dark theme.
  * Pre-seeded 4 quick-login test accounts for developer testing on localhost (password: `123789`): `test@test.com`, `test@test1.com`, `test@test2.com`, and `test@test3.com`. Accounts automatically register on first click.
  * Added global `AuthProvider.tsx` context using `onAuthStateChange` to listen and synchronize sessions across React components.
  * Implemented `Frontend/src/middleware.ts` to refresh and synchronize Supabase JWT cookies server-side on Next.js App Router requests.
* **Database & RLS Upgrades (`008_auth_profiles.sql`, `009_fix_rls.sql`):**
  * Created `profiles` table that automatically maps `auth.users` via database triggers to sync display names upon registration.
  * Created `is_room_member(room_id)` helper function using `SECURITY DEFINER` to bypass RLS and prevent infinite recursion on tables referencing `room_participants`.
  * Configured RLS select rules allowing authenticated users access to active rooms, bids, and chat logs, while leaving public discovery rooms open to anonymous users.
* **Homepage Profile Pill & Page Guards:**
  * Added profile bar to the home page `/` showcasing the active user's initials, email address, and a sign-out button (with transition state checks).
  * Added route redirect guards to `/room/[id]`, `/rooms`, `/create`, `/join`, and `/join/[code]` redirecting unauthenticated users to `/auth`.

### Changed
* **useLocalUser Hook:** Refactored identity management to pull user IDs from the active authentication session instead of generating local UUIDs. Maintains room details inside localStorage to retain user-to-room affinity.

---

## [1.2.0] - 2026-06-26

A large release: a full Vercel-inspired dark visual redesign, realtime
correctness fixes, room discovery, configurable room options, an access-control
model, and a "high-dopamine" auction-ordering algorithm.

### Added
* **Vercel-inspired design system (`Frontend/src/app/globals.css`, `Frontend/src/app/layout.tsx`):**
  * Re-tokenised the entire theme around a stark, dark, ink-on-near-black surface
    ladder (`void` / `surface` / `surface-raised`), hairline borders
    (`hairline`, `hairline-strong`), a calm text ladder (`chalk` / `body` /
    `mute`), `link`-blue as the interactive accent, and a single warm `amber`
    energy accent reserved for live-bid / SOLD moments.
  * Added the brand **mesh gradient** (`mesh-gradient` + `animate-mesh-drift`)
    as hero-scale decoration, an `eyebrow` mono-caps label utility, stacked
    elevation shadow variables, and `Inter` (display+body) / `JetBrains Mono`
    (technical) typography.
* **Tournament selector on the landing page (`Frontend/src/app/page.tsx`):** the hero now
  sits above a "TOURNAMENTS" section with a selectable **IPL 2026** card that
  routes to the rooms hub.
* **Rooms hub (`Frontend/src/app/rooms/page.tsx`):** a discovery page with Create / Join
  actions, a live **Public Rooms** list (auto-refreshing), and a **Your Rooms**
  list of rooms the user has joined.
* **Room discovery APIs (`Frontend/src/lib/api.ts`):** `listPublicRooms()` (open, public
  LOBBY rooms with participant counts) and `listMyRooms(userId)`.
* **Configurable room options (`Database/supabase/migrations/007_room_options.sql`,
  `Frontend/src/app/create/page.tsx`):** fixed segmented selectors for Purse
  (₹100 / 150 / 200 / 250 Cr), Squad size (10 / 15 / 20 / 25), Bid timer
  (10 / 15 / 20 / 25 / 30s), Player order (Random / By Category), plus a
  **Public / Private** visibility toggle (`rooms.is_public`).
* **High-dopamine auction ordering (`seed_room_players()`):** the `CATEGORY`
  strategy interleaves players by rating tier (top+medium `rating >= 6` drawn
  ~75%, low `< 6` drawn ~25%), each pool shuffled independently so the order is
  exciting and never repeats. `RANDOM` remains as a pure shuffle.
* **Hover-to-peek next player (`Frontend/src/components/auction/BalancePanel.tsx`):**
  hovering the Balance panel flips it (3D `rotateY`) to preview the next
  player's photo + name; disabled on the final player. Backed by a new
  `snapshot.nextPlayer` field.
* **Reusable player image with fallback (`Frontend/src/components/auction/PlayerImage.tsx`):**
  renders the real headshot and falls back to an initials avatar on error —
  used by the player card, My Squad, and the next-player peek.
* **Exit to Home button (`Frontend/src/components/results/ResultsView.tsx`):** post-auction
  results screen now links back to the landing page.
* **Reproducible seed generator (`Database/data-extraction/generate_seed.mjs`):**
  regenerates `Database/supabase/seed.sql` from `ipl_2026_auction_dataset.json`
  (idempotent; derives numeric `base_price_lakhs` from the display string).
* **Migration guide (`Database/supabase/MIGRATIONS.md`):** documents the apply order and
  what each migration does.

### Changed
* **Realtime balance sync (`Frontend/src/hooks/useRoom.ts`,
  `Database/supabase/migrations/006_realtime_fix.sql`):** every realtime signal now
  reconciles the full snapshot, and realtime tables are set to
  `REPLICA IDENTITY FULL` so participant budget UPDATEs reach **all** clients,
  not just the admin. (See Fixed.)
* **Player profile card (`Frontend/src/components/auction/PlayerCard.tsx`):** rebuilt to
  show `{playerName} – {teamName}`, an info row (`role · nationality ·
  Experience N years`), a `Rating x/10 · BasePrice` row, and a large
  edge-to-edge headshot that bleeds to the card edges with a matching
  background (no seam).
* **Bid history (`Frontend/src/components/auction/BidHistory.tsx`):** compact,
  center-anchored, name + amount only — the latest/highest bid stays pinned in
  the center while older bids fan out and fade. Removed the bulky chip layout
  and its animations to stop the timer/bid glitching.
* **Countdown timer (`Frontend/src/components/auction/CountdownTimer.tsx`,
  `Frontend/src/hooks/useTimer.ts`):** redesigned to a single, professional ring on the
  brand palette (ink → amber ≤10s → red ≤5s), monospaced `tabular-nums`
  readout, no glow/pulse/emoji. The ring now uses the room's **actual**
  `bid_timer_seconds` for accuracy instead of guessing the duration.
* **Admin controls (`Frontend/src/components/auction/AdminToolbar.tsx`):** moved from a
  floating bottom-right panel into the top-right header as an inline,
  admin-only control cluster (visible only during `AUCTION` / `PAUSED`).
* **Create flow back-link** now returns to the rooms hub (`/rooms`).

### Fixed
* **Other participants' balances not updating live:** caused by realtime tables
  using the default `REPLICA IDENTITY` (PK-only), so RLS-gated UPDATE events on
  `room_participants` weren't delivered to every subscriber. Fixed via
  `REPLICA IDENTITY FULL` + full-snapshot reconciliation on the room update
  signal.

### Security
* **Private rooms + link-tamper guard (`Frontend/src/app/room/[id]/page.tsx`):** private
  rooms are excluded from discovery and, for a non-participant who opens the URL
  directly, the join CTA / room code is **not** shown — only public, joinable
  (LOBBY) rooms expose a Join action. Joining still requires the host's invite
  link for private rooms.

---

## [1.1.0] - 2026-06-26

This release implements major UI/UX improvements, viewport optimizations, layout fixes, and bids handling refactoring.

### Added
* **Centered Bids Timeline (`Frontend/src/components/auction/BidHistory.tsx`):**
  * Replaced the standard vertical scrolling list of bids with a horizontal, centered timeline showing at most the 5 latest bids.
  * The newest/highest bid is highlighted in the center, and previous bids shift left/right.
  * Empty slots render invisible placeholders (`w-20` divs) to prevent layout shifting.
* **Inline Resolution Indicator (`Frontend/src/components/auction/CountdownTimer.tsx`):**
  * Relocated the auction resolution overlay into the center of the countdown timer circle.
  * Renders `SOLD!` with the winning squad name and final price (pulsing green), or `UNSOLD` (faded gray).
* **Dynamic Increment Matrix (`Frontend/src/lib/bidCalculator.ts`):**
  * Added a dynamic multiplier calculator that maps base prices to four distinct budget tiers (Budget, Mid, Premium, Marquee).
  * Automatically rounds increments based on size ranges ($<100\text{L} \rightarrow 5\text{L}$, $<500\text{L} \rightarrow 10\text{L}$, $<1000\text{L} \rightarrow 25\text{L}$, $\ge 1000\text{L} \rightarrow 50\text{L}$).
  * Added fallback and emergency logic to guarantee up to 4 valid ascending bidding options within a participant's budget.
* **Custom Styling and Animations (`Frontend/src/app/globals.css`):**
  * Created the `animate-chip-enter` animation (combining keyframe scale-up and border flash) for new bids.
  * Integrated the `pulse-ring` and `result-pulse` keyframe loops to draw attention to timer alerts ($\le 10$ seconds left) and resolution states.

### Fixed
* **Dev Server Exit Bug:** Resolved an issue where the Next.js dev server would terminate immediately back to the shell after launching, causing connection errors on localhost:3000.
* **Zero-Scroll Viewport Lock:**
  * Added `h-screen overflow-hidden` to `Frontend/src/app/room/[id]/page.tsx` to lock layouts within the device screen.
  * Configured middle column components in `Frontend/src/components/auction/AuctionView.tsx` with `shrink-0` and `min-h-0` parameters to prevent layout shifting.
  * Configured scroll bars (`overflow-y-auto`) exclusively inside panels (`ChatPanel.tsx` and `TeamsPanel.tsx`).
* **Timer Size Consistency:** Standardized the countdown timer size to `172px` (reduced from `200px`) in `Frontend/src/components/auction/CountdownTimer.tsx` and `Frontend/src/components/auction/AuctionView.tsx` to fit smaller screens.

### Removed
* **Light Mode Support:** Completely removed light mode overrides, provider contexts, and toggle buttons due to visual bugs.
  * Removed `ThemeProvider` wrapper and `ThemeToggle` component from `Frontend/src/app/layout.tsx`.
  * Removed `.light` styles and custom shadow variables from `Frontend/src/app/globals.css`.
  * Removed padding spacers (`pr-11` offset) from `Frontend/src/app/room/[id]/page.tsx`.
* **Full-Screen Overlays:** Deprecated the full-screen `SoldMoment` overlay component (`Frontend/src/components/auction/SoldMoment.tsx`) to prevent screen-blocking interruptions.

---

## [1.0.0] - 2026-06-25

This release marks the initial stable launch of the real-time IPL Auction scaffold.

### Added
* **Database Scaffold:**
  * Schema creation (`Database/supabase/migrations/001_schema.sql`): core tables for `rooms`, `players`, `room_participants`, `room_players`, and `bids`.
  * Security policies (`Database/supabase/migrations/002_rls_policies.sql`): configured Row-Level Security parameters.
  * Procedures and functions (`Database/supabase/migrations/003_functions.sql`): security definer functions for transactions (`start_auction`, `place_bid`, `check_and_resolve`, etc.).
  * Sweeper cron (`Database/supabase/migrations/004_cron.sql`): runs `resolve_expired_auctions()` every 60 seconds to resolve abandoned rooms.
* **Seed Catalog (`Database/supabase/seed.sql`):** Populated database with ~100 IPL players, expertises, countries, and base prices.
* **Realtime Sync System (`Frontend/src/lib/supabase/realtime.ts`):** Client-side listener wrappers using Supabase subscriptions to catch update, insert, and delete logs on room tables.
* **Client Service Wrappers (`Frontend/src/lib/api.ts`):** Client-side API functions for joining, bidding, pausing, resuming, skipping, and fetching room snapshots.
* **Lobby & Core Views:**
  * Create room lobby interface (`Frontend/src/app/create/page.tsx`).
  * Room join validator (`Frontend/src/app/join/page.tsx`).
  * Live auction multiplayer screen (`Frontend/src/app/room/[id]/page.tsx` & `Frontend/src/components/auction/AuctionView.tsx`).
  * Post-auction squad results display (`Frontend/src/components/results/ResultsView.tsx`).
* **Custom Hooks:** Custom animation frame calculation hook (`Frontend/src/hooks/useTimer.ts`) with clock offset calibration.
* **Local Dev Testing Bypass:** Added `start_auction_dev` RPC database functions allowing developers to bypass the 3-participant limit in local development (`npm run dev:test`).
