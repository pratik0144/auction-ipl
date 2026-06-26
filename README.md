# 🏏 11Auction - High-Fidelity Realtime IPL Fantasy Cricket Auction

**11Auction** is an IPL-themed live multiplayer cricket auction application. Built for groups of 3–5 users, it simulates a real-world sports auction experience where participants bid on a randomized pool of ~100 IPL players under strict purse budget and squad size constraints.

The application leverages a modern **Serverless Realtime** architecture. The frontend is built on **Next.js 16 (App Router)** and styled with **Tailwind CSS v4**. The backend is powered by **Supabase** (PostgreSQL database, real-time sync listeners, and security definer database functions).

---

## 🚀 Key Features

* **Realtime Synchronization Engine:** Bids, timers, and lobby updates sync instantly across all connected screens via **Supabase Realtime WebSockets (`postgres_changes`)**.
* **Zero-Scroll Viewport Lock:** The UI is designed to fit desktop and laptop displays (`h-screen overflow-hidden`). Strict grid sizing prevents components from shifting when active bids accumulate or when chat messages are sent.
* **Animated Centered Timeline:** Displays the latest 5 bids in a horizontal timeline. The newest bid is highlighted in the center with enter transitions, and older bids shift outwards.
* **Dynamic Bid Increment Calculator:** Custom increment options are computed dynamically based on the player's base price tier (Budget, Mid, Premium, Marquee) and filtered based on each participant's remaining budget.
* **Inline Status Indicators:** Displays auction results (`SOLD` or `UNSOLD`) inside the central timer circular interface to maintain a clean layout without full-screen overlays.
* **Admin Controls Dashboard:** The room creator has access to real-time administrative actions, including pausing, resuming, skipping active nominations, or ending the auction early.
* **Post-Auction Analytics:** A comprehensive Results screen showing participant budgets, total spend, player counts, and roster breakdowns. Includes a "Copy Results" share option.
* **Dark Mode Aesthetics:** A premium dark sports-broadcast aesthetic using custom tokens (`void`, `surface`, `amber`, `chalk`) and subtle micro-interactions.

---

## 🛠️ Technology Stack

* **Frontend:**
  * **Framework:** Next.js 16 (App Router)
  * **UI Library:** React 19 (Hooks, Context, Reference loops)
  * **Styling:** Tailwind CSS v4 (using `@import "tailwindcss"` and `@theme inline`)
* **Backend:**
  * **Database:** PostgreSQL (Supabase Cloud Database)
  * **Realtime Broadcasts:** Supabase Realtime Channel API
  * **Authorization:** Supabase Auth (supports anonymous and email accounts)
* **Dev Environment:**
  * **Language:** TypeScript 5
  * **Package Manager:** NPM

---

## 📁 Project Structure & Module Directory

```text
11auc/
├── supabase/                        # Database schemas and functions
│   ├── migrations/
│   │   ├── 001_schema.sql           # Core tables (rooms, players, room_players, bids, etc.)
│   │   ├── 002_rls_policies.sql     # Row-level security settings
│   │   ├── 003_functions.sql        # Database RPC functions (place_bid, check_and_resolve, etc.)
│   │   └── 004_cron.sql             # pg_cron periodic sweeper configuration
│   ├── seed.sql                     # Seed data containing ~100 IPL players, expertises, and ratings
│   ├── dev_functions.sql            # Helper functions to clear test data in development
│   └── 005_chat.sql                 # Live chat tables and sending procedures
├── src/
│   ├── app/                         # App Router Pages & API routes
│   │   ├── api/
│   │   │   └── rooms/
│   │   │       ├── route.ts         # POST: Server-side room initialization wrapper
│   │   │       └── [id]/
│   │   │           └── route.ts     # GET: Room snapshot resolver
│   │   ├── create/
│   │   │   └── page.tsx             # Create Room setup form (budget, timers)
│   │   ├── join/
│   │   │   ├── page.tsx             # Room finder and validation screen
│   │   │   └── [code]/
│   │   │       └── page.tsx         # Auto-joining redirection helper
│   │   ├── room/
│   │   │   └── [id]/
│   │   │       └── page.tsx         # Root real-time lobby and live auction page wrapper
│   │   ├── globals.css              # Custom Tailwind v4 styling system and animations
│   │   └── layout.tsx               # App layout, metadata, and typography imports
│   ├── components/                  # Shared UI components
│   │   ├── auction/
│   │   │   ├── AdminToolbar.tsx     # Pause, resume, skip, and end overrides (admin only)
│   │   │   ├── AuctionView.tsx      # Fixed three-column live auction console layout
│   │   │   ├── BalancePanel.tsx     # Budget spend bar and squad count indicators
│   │   │   ├── BidButtons.tsx       # Dynamic bidding increment grid (2x2)
│   │   │   ├── BidHistory.tsx       # Center-out horizontal 5-chip timeline
│   │   │   ├── ChatPanel.tsx        # Localized chat scroll feed and sender input
│   │   │   ├── CountdownTimer.tsx   # SVG ring countdown timer and inline results
│   │   │   ├── MySquad.tsx          # Personal roster slots (sold + empty slots)
│   │   │   ├── PlayerCard.tsx       # Active player profile, nationality, and rating
│   │   │   └── TeamsPanel.tsx       # Accordion tracking other teams' spent budgets and rosters
│   │   └── results/
│   │       └── ResultsView.tsx      # Post-auction summary and text report share button
│   ├── hooks/
│   │   ├── useTimer.ts              # requestAnimationFrame timer calculations
│   │   └── useWindowSize.ts         # Responsiveness window tracking utility
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts            # Single-instance browser Supabase client wrapper
│   │   │   ├── server.ts            # Cookie-aware server-side Supabase client wrapper
│   │   │   └── realtime.ts          # Postgres changes channel subscription wrappers
│   │   ├── api.ts                   # Client-side API wrappers for database RPC calls
│   │   ├── bidCalculator.ts         # Bidding increment percentage math and fallbacks
│   │   ├── types.ts                 # TS typings representing the database schemas
│   │   └── utils.ts                 # Currency and text formatting utilities
├── package.json                     # CLI scripts, dev tools, and packages
├── tsconfig.json                    # Compiler settings
├── ARCHITECTURE.md                  # Detailed architectural overview
└── next.config.ts                   # Next.js configurations
```

---

## ⚙️ Getting Started & Local Setup

### 1. Project Installation
Install Node packages locally:
```bash
npm install
```

### 2. Connect Supabase Database
1. Create a project on the [Supabase Dashboard](https://supabase.com/).
2. Navigate to the SQL Editor in Supabase, copy the SQL files in `supabase/migrations/` and run them sequentially (`001` through `005`). Alternatively, use the Supabase CLI:
   ```bash
   supabase migration up
   ```
3. Run the SQL statements in `supabase/seed.sql` to import the cricket player catalog.
4. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```
5. Open `.env.local` and add your database variables:
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
This launches the application on port `3003` with `NEXT_PUBLIC_DEV_MODE=true`.

---

## 🎮 Gameplay & Interactive Flow

### A. Host Setup
1. **Lobby Creation:** Click "Create Room" on the homepage.
2. **Parameters:** Set parameters like starting budget (default ₹120 Cr), timer length (default 30s), and squad sizes.
3. **Invitation:** Share the 6-character room code from the header with other participants.

### B. Participant Join
1. **Room Entry:** Bidders go to the homepage, select "Join Room", and enter the code.
2. **Setup:** Choose display names and team squad names.
3. **Wait Lobby:** Connect to the lobby. The page updates in real-time as users join.

### C. Live Bidding Loop
1. **Nomination:** The admin clicks "Start" to nominate a player.
2. **Bidding:** The player card and countdown timer appear. Bidders select bidding options computed by the bid calculator.
3. **Anti-Sniping:** Bids placed with less than 10 seconds remaining automatically extend the timer by 10 seconds.
4. **Resolution:** When the timer expires, the highest bidder wins the player, budgets are updated, and the room advances to the next player.

### D. Post-Auction Summary
1. ** Roster Overview:** Once all players are nominated, the room displays the Results dashboard.
2. **Sharing:** Click "Share Results" to copy a detailed text summary of rosters and spend details to the clipboard.
