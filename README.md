# 🏏 11Auction - High-Fidelity Realtime IPL Fantasy Cricket Auction

**11Auction** is an IPL-themed live multiplayer cricket auction application. Built for groups of 3–5 users, it simulates a real-world sports auction experience where participants bid on a randomized pool of ~90 real IPL players under strict purse budget and squad size constraints.

The application leverages a modern **Serverless Realtime** architecture. The frontend is built on **Next.js 16 (App Router)** and styled with **Tailwind CSS v4** in a **Vercel-inspired dark design system**. The backend is powered by **Supabase** (PostgreSQL database, real-time sync listeners, and security definer database functions).

> **Identity model:** Supabase Email/Password authentication is integrated. Users register or log in via a toggle-style sign-in/sign-up page (`/auth`). Authenticated sessions are synchronized across the application via React Context (`AuthProvider.tsx`) and cookies are kept fresh on both server/client components via Next.js Middleware. A dev-only quick login dashboard is available for developers on localhost.

---

## 🚀 Key Features

* **Realtime Synchronization Engine:** Bids, timers, budgets, and lobby updates sync instantly across all connected screens via **Supabase Realtime WebSockets (`postgres_changes`)**. Realtime tables use `REPLICA IDENTITY FULL` so every client (not just the admin) receives participant budget updates.
* **Room Discovery Hub (`/rooms`):** Browse open **Public Rooms** (auto-refreshing), jump back into **Your Rooms**, or create/join from one place. A tournament selector on the landing page routes here.
* **Configurable Rooms:** Fixed-option setup — Purse (₹100/150/200/250 Cr), Squad size (10/15/20/25), Bid timer (10/15/20/25/30s), Player order (Random / By Category), and a **Public/Private** visibility toggle.
* **High-Dopamine Player Ordering:** The `By Category` strategy interleaves players by rating tier (top+medium ~75%, low ~25%, independently shuffled) so star players are sprinkled throughout and the order **never repeats**.
* **Hover-to-Peek Next Player:** Hovering the Balance panel flips it (3D) to preview the next player coming up; disabled on the final player.
* **Professional Countdown Timer:** A single clean SVG ring on the brand palette (ink → amber ≤10s → red ≤5s) with a monospaced `tabular-nums` readout, driven by the room's real timer length for accuracy.
* **Centered Bid History:** The latest/highest bid stays pinned in the center while older bids fan out and fade — compact name + amount, no layout glitching.
* **Dynamic Bid Increment Calculator:** Increment options computed from the player's base-price tier and filtered by each participant's remaining budget.
* **Admin Controls in Header:** The room creator gets an inline, admin-only control cluster (pause, resume, skip, end) in the top-right header during the auction.
* **Post-Auction Analytics + Exit:** A Results screen showing budgets, spend, player counts, and rosters, with "Copy Results" sharing and an **Exit to Home** button.
* **Vercel-Inspired Dark Aesthetic:** A stark ink-on-near-black surface ladder, hairline borders, `link`-blue interactive accent, a single warm `amber` energy accent, the brand mesh gradient at hero scale, and `Inter` / `JetBrains Mono` typography.

---

## 🛠️ Technology Stack

* **Frontend:**
  * **Framework:** Next.js 16 (App Router)
  * **UI Library:** React 19 (Hooks, Context, Reference loops)
  * **Styling:** Tailwind CSS v4 (using `@import "tailwindcss"` and `@theme inline`)
* **Backend:**
  * **Database:** PostgreSQL (Supabase Cloud Database)
  * **Realtime Broadcasts:** Supabase Realtime Channel API (`postgres_changes`)
  * **Authorization:** Supabase Email/Password Authentication & Row-Level Security (RLS); writes via `SECURITY DEFINER` RPC functions requiring active user sessions (identity backed by `auth.users` + dynamic profile sync)
* **Dev Environment:**
  * **Language:** TypeScript 5
  * **Package Manager:** NPM

---

## 📁 Project Structure & Module Directory

```text
11auc/
├── Database/                        # Database schemas, seeds, data extraction scripts
│   ├── supabase/
│   │   ├── migrations/
│   │   │   ├── 001_schema.sql       # Core tables (rooms, players, room_players, bids)
│   │   │   ├── 002_rls_policies.sql # (legacy, auth-based — superseded; see MIGRATIONS.md)
│   │   │   ├── 003_functions.sql    # Database RPC functions (place_bid, check_and_resolve, etc.)
│   │   │   ├── 004_cron.sql         # pg_cron periodic sweeper configuration
│   │   │   ├── 005_chat.sql         # Live chat tables and sending procedures
│   │   │   ├── 006_realtime_fix.sql # REPLICA IDENTITY FULL + publication fix (balance sync)
│   │   │   ├── 007_room_options.sql # is_public, player_order + seed_room_players() ordering
│   │   │   ├── 008_auth_profiles.sql# Profiles table, auto-insert triggers on signup
│   │   │   └── 009_fix_rls.sql      # Recursion-free RLS policy configuration using helper functions
│   │   ├── combined_migration.sql   # One-shot setup for a fresh database (all tables, functions, catalogs)
│   │   ├── seed.sql                 # ~100 IPL players (auto-generated from the JSON)
│   │   ├── dev_functions.sql        # start_auction_dev (solo testing bypass)
│   │   └── MIGRATIONS.md            # Apply order + what each migration does
│   └── data-extraction/             # Player dataset + tooling
│       ├── ipl_2026_auction_dataset.json # ~90 real IPL players (source of truth)
│       └── generate_seed.mjs        # Regenerates seed.sql from the JSON
├── Backend/                         # Actual backend and server-side logic
│   ├── api/rooms/route.ts           # POST: server-side room initialization logic
│   ├── api/rooms/[id]/route.ts      # GET: room snapshot resolver logic
│   └── middleware.ts                # Server-side authentication and cookie refresh logic
├── Frontend/                        # Frontend UI and Next.js compiler application
│   ├── public/                      # Static assets and images
│   ├── src/
│   │   ├── app/                     # App Router Pages & API routes
│   │   │   ├── api/rooms/route.ts   # API wrapper exporting POST handler from Backend
│   │   │   ├── api/rooms/[id]/route.ts # API wrapper exporting GET handler from Backend
│   │   │   ├── auth/page.tsx        # Sign In / Sign Up view + Local Dev logins
│   │   │   ├── page.tsx             # Landing: hero + tournament selector + user profile header
│   │   │   ├── rooms/page.tsx       # Rooms hub: create/join, public rooms, your rooms
│   │   │   ├── create/page.tsx      # Create Room (fixed-option selectors + toggles)
│   │   │   ├── join/page.tsx        # Join by code
│   │   │   ├── join/[code]/page.tsx # Auto-filled join (invite link target)
│   │   │   ├── room/[id]/page.tsx   # Realtime lobby / auction / results wrapper
│   │   │   └── globals.css          # Vercel-inspired Tailwind v4 design system
│   │   ├── components/
│   │   │   ├── AuthProvider.tsx     # Auth state listener & React Context provider
│   │   │   ├── auction/             # Auction UI components (AuctionView, timer, chat, etc.)
│   │   │   └── lobby/LobbyView.tsx  # Pre-auction lobby waiting room
│   │   ├── hooks/                   # Custom client-side hooks (useRoom, useTimer, etc.)
│   │   ├── lib/                     # Client API wrappers, types, and client supabase wrappers
│   │   └── middleware.ts            # Middleware wrapper calling the Backend middleware
│   ├── next.config.ts               # Configuration mapping the Turbopack compile root
│   └── tsconfig.json                # TypeScript aliases mapping @frontend and @backend paths
├── package.json                     # Root configuration proxy script executor
└── ARCHITECTURE.md                  # Detailed architectural overview
```

---

## ⚙️ Getting Started & Local Setup

### 1. Project Installation
Install Node packages locally from the root folder (runs the command inside `Frontend` using proxy config):
```bash
npm install
```

### 2. Connect Supabase Database
1. Create a project on the [Supabase Dashboard](https://supabase.com/).
2. **Fresh setup (recommended):** open the Supabase SQL Editor and execute:
   * **`Database/supabase/combined_migration.sql`** (base schema, catalogs, seed, RPCs)
   * **`Database/supabase/005_chat.sql`** (live chat schema & RPCs)
   * **`Database/supabase/migrations/008_auth_profiles.sql`** (user profile schema & trigger)
   * **`Database/supabase/migrations/009_fix_rls.sql`** (recursion-free auth RLS configuration)
   * **`Database/supabase/dev_functions.sql`** (solo-testing bypass)
   * See **`Database/supabase/MIGRATIONS.md`** for incremental details.
3. **Configure Authentication settings in Supabase Dashboard:**
   * Go to **Authentication** -> **Settings**.
   * Under **User Sign Up**, turn **OFF** "Confirm Email" / "Enable email confirmations". This allows new users to register and log in instantly without waiting for an email verification token.
4. **Developer Quick Login (Localhost only):**
   * When `NEXT_PUBLIC_DEV_MODE=true` is enabled, the `/auth` page presents a quick-login grid populated with testing credentials.
   * Testing accounts (password: `123789`):
     * `test@test.com`
     * `test@test1.com`
     * `test@test2.com`
     * `test@test3.com`
     * These accounts will automatically sign up on first click if they do not exist.
5. The players catalog is seeded by the combined migration. To re-seed independently, run `Database/supabase/seed.sql` (regenerate it from the JSON with `node Database/data-extraction/generate_seed.mjs`).
6. Copy the environment template inside `Frontend/`:
   ```bash
   cp Frontend/.env.example Frontend/.env.local
   ```
7. Open `Frontend/.env.local` and add your database variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```

### 3. Run Development Server
To launch the hot-reloading development server on port `3000`:
```bash
npm run dev
```

### 4. Enable Local Dev/Testing Mode
To run locally with bypass controls enabled (allows launching the auction with fewer than 3 participants for testing):
```bash
npm run dev:test
```
This launches the Next.js application inside `Frontend/` on port `3003` with `NEXT_PUBLIC_DEV_MODE=true`.

---

## 🎮 Gameplay & Interactive Flow

### A. Host Setup
1. **Pick the tournament:** On the landing page, select **IPL 2026** to open the rooms hub (`/rooms`), then click **Create Room**.
2. **Parameters:** Choose from fixed options — Purse (₹100/150/200/250 Cr), Squad size (10/15/20/25), Bid timer (10/15/20/25/30s), Player order (**Random** or **By Category**), and **Public/Private** visibility.
3. **Invitation:** Share the 6-character room code (or the `/join/{code}` invite link) from the header. Private rooms are not listed in Public Rooms and can only be joined via the invite link.

### B. Participant Join
1. **Discover or enter:** Join an open room from the **Public Rooms** list, or choose "Join Room" and enter a code.
2. **Setup:** Choose display and squad names.
3. **Wait Lobby:** The lobby updates in real-time as users join.

### C. Live Bidding Loop
1. **Nomination:** The admin clicks "Start". Players are ordered by the room's chosen strategy — **By Category** sprinkles star/medium players through the auction (~75% priority) for a livelier flow.
2. **Bidding:** The player card and countdown ring appear. Bidders select increment options computed by the bid calculator.
3. **Anti-Sniping:** Bids placed with less than 10 seconds remaining extend the timer by 10 seconds.
4. **Resolution:** When the timer expires, the highest bidder wins, budgets update live for **all** clients, and the room advances to the next player.

### D. Post-Auction Summary
1. **Roster Overview:** Once all players are resolved, the Results dashboard appears.
2. **Sharing & Exit:** Click "Share Results" to copy a text summary, or "Exit to Home" to return to the landing page.
