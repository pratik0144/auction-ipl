# 🧠 11Auction - Complete Technical Reference & Knowledge Base (brain.md)

This document serves as the absolute, single-source-of-truth technical reference and architectural specification for the **11Auction** application. It is designed to provide incoming AI agents and developers with a comprehensive understanding of the project's systems, data schemas, timing loops, concurrency patterns, security constraints, and styling frameworks.

---

## 🏛️ 1. Global Architectural Overview

11Auction uses an **Event-Driven Serverless Loop** that integrates a Next.js App Router frontend with a Supabase PostgreSQL backend. It does not run a persistent node.js server process to maintain game state or track connections. Instead, all game events are driven by transactional SQL queries and synchronized using PostgreSQL write-ahead logs (WAL) via WebSockets.

### Data Flow Diagram
```
                                Next.js App Router Client (React 19)
                           ┌──────────────────────────────────────────────┐
                           │   Lobby, Room state, Player nominations,     │
                           │   Dynamic bid calculator, Visual countdowns  │
                           └──────┬────────────────────────────────▲──────┘
                                  │                                │
                       Database Transaction (RPC)          Realtime Channel Sync
                                  │                          (postgres_changes)
                                  ▼                                │
                           ┌──────────────┐                        │
                           │ Supabase API │                        │
                           └──────┬───────┘                        │
                                  │                                │
                                  ▼                                │
                      ┌──────────────────────┐                     │
                      │ Row-Level Security   │                     │
                      │ (RLS policies check) │                     │
                      └──────────┬───────────┘                     │
                                 │                                 │
                                 ▼                                 │
                     ┌────────────────────────┐                    │
                     │  PostgreSQL Database   │                    │
                     ├────────────────────────┤                    │
                     │  SELECT FOR UPDATE     │                    │
                     │  Write Audit logs      ├────────────────────┘
                     │  Trigger WAL Events    │
                     └────────────────────────┘
```

### Unidirectional Loop Lifecycle
1. **Initiation:** The client triggers an action (e.g. placing a bid, pausing the timer, joining a lobby) by executing a PostgreSQL database function (`RPC`) using the Supabase Browser SDK.
2. **Isolation & Locking:** The database starts an ACID-compliant transaction. It locks relevant database rows (`SELECT FOR UPDATE`) to prevent race conditions or double-spending, verifies the room configurations, and updates the state.
3. **Log Commit:** The committed database updates write to the PostgreSQL Write-Ahead Log (WAL).
4. **Broadcast:** The Supabase Realtime service monitors the WAL and broadcasts the change payloads via WebSockets to all clients listening to that `room_id`.
5. **UI Update:** The clients receive the database change payloads, update their React state representation (`RoomSnapshot`), and display the changes.

---

## 💾 2. Comprehensive Database Schema & Typed Definitions

All database models reside in the `public` schema. This section details the PostgreSQL table definitions alongside their corresponding TypeScript definitions.

### A. Core TypeScript Definitions (`Frontend/src/lib/types.ts`)
```typescript
export type RoomStatus = 'LOBBY' | 'AUCTION' | 'PAUSED' | 'COMPLETED';
export type AuctionPlayerStatus = 'PENDING' | 'ACTIVE' | 'SOLD' | 'UNSOLD';
export type PlayerRole = 'Batter' | 'Wicketkeeper-Batter' | 'All-rounder' | 'Pace Bowler' | 'Spin Bowler' | 'Bowler';

export interface Player {
  id: string;
  team_name: string;
  player_name: string;
  player_img_url: string;
  player_expert_in: PlayerRole;
  nationality: string;
  experience_years: number;
  base_price_lakhs: number;
  base_price_display: string;
  rating: number;
}

export interface Room {
  id: string;
  room_code: string;
  room_name: string;
  admin_user_id: string;
  status: RoomStatus;
  purse_budget_lakhs: number;
  max_squad_size: number;
  bid_timer_seconds: number;
  current_player_order_index: number | null;
  created_at: string;
}

export interface RoomParticipant {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  squad_name: string;
  remaining_budget_lakhs: number;
  joined_at: string;
}

export interface RoomPlayer {
  id: string;
  room_id: string;
  player_id: string;
  order_index: number;
  status: AuctionPlayerStatus;
  winning_participant_id: string | null;
  sold_price_lakhs: number | null;
  ends_at: string | null;
  remaining_seconds_on_pause: number | null;
  player?: Player; // Joined field
}

export interface Bid {
  id: string;
  room_id: string;
  room_player_id: string;
  participant_id: string;
  amount_lakhs: number;
  created_at: string;
  participant?: RoomParticipant; // Joined field
}

export interface ChatMessage {
  id: string;
  room_id: string;
  participant_id: string;
  message: string;
  created_at: string;
  participant?: RoomParticipant; // Joined field
}
```

### B. PostgreSQL Schema Implementations (`Database/supabase/migrations/001_schema.sql` & `Database/supabase/005_chat.sql`)

```sql
-- Enums
CREATE TYPE room_status AS ENUM ('LOBBY', 'AUCTION', 'PAUSED', 'COMPLETED');
CREATE TYPE auction_player_status AS ENUM ('PENDING', 'ACTIVE', 'SOLD', 'UNSOLD');
CREATE TYPE player_role AS ENUM ('Batter', 'Wicketkeeper-Batter', 'All-rounder', 'Pace Bowler', 'Spin Bowler', 'Bowler');

-- Catalog of cricketers
CREATE TABLE players (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name        text          NOT NULL,
  player_name      text          NOT NULL,
  player_img_url   text,
  player_expert_in player_role  NOT NULL,
  nationality      text          NOT NULL,
  experience_years int          NOT NULL DEFAULT 0,
  base_price_lakhs int           NOT NULL,
  base_price_display text        NOT NULL,
  rating           decimal(3,1)
);

-- Active rooms
CREATE TABLE rooms (
  id                        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code                 varchar(6)    UNIQUE NOT NULL,
  room_name                 text          NOT NULL,
  admin_user_id             uuid          NOT NULL,
  status                    room_status   NOT NULL DEFAULT 'LOBBY',
  purse_budget_lakhs        int           NOT NULL DEFAULT 12000,
  max_squad_size            int           NOT NULL DEFAULT 18,
  bid_timer_seconds         int           NOT NULL DEFAULT 30,
  current_player_order_index int,
  created_at                timestamptz   NOT NULL DEFAULT now()
);

-- Participants linked to rooms
CREATE TABLE room_participants (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id                uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id                uuid        NOT NULL,
  display_name           text        NOT NULL,
  squad_name             text        NOT NULL,
  remaining_budget_lakhs int         NOT NULL,
  joined_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

-- Player lists inside active rooms
CREATE TABLE room_players (
  id                         uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id                    uuid                  NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id                  uuid                  NOT NULL REFERENCES players(id),
  order_index                int                   NOT NULL,
  status                     auction_player_status NOT NULL DEFAULT 'PENDING',
  winning_participant_id     uuid                  REFERENCES room_participants(id),
  sold_price_lakhs           int,
  ends_at                    timestamptz,
  remaining_seconds_on_pause int,
  UNIQUE(room_id, player_id)
);

-- Individual bids
CREATE TABLE bids (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_player_id  uuid        NOT NULL REFERENCES room_players(id) ON DELETE CASCADE,
  participant_id  uuid        NOT NULL REFERENCES room_participants(id) ON DELETE CASCADE,
  amount_lakhs    int         NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Chat messaging
CREATE TABLE room_chats (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id  uuid        NOT NULL REFERENCES room_participants(id) ON DELETE CASCADE,
  message         text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### C. Index Declarations & Optimization Reasoning
* `idx_rooms_room_code` on `rooms(room_code)`: Optimizes access when joining lobby rooms.
* `idx_room_players_room_status` on `room_players(room_id, status)`: Speeds up queries when searching for pending players.
* `idx_bids_room_player_amount` on `bids(room_player_id, amount_lakhs DESC)`: Speeds up checking active bids for high-frequency pricing updates.
* `idx_room_chats_created_at` on `room_chats(room_id, created_at)`: Optimizes chronological loading of room messages.

---

## ⏱️ 3. Realtime Timing Loops, Drift Correction & Resolution

Auction timers operate on authoritative PostgreSQL servers. Bidding durations, extensions, and resolution processes are written into SQL triggers.

### A. Clock Drift Calibration Algorithm
Since client system clocks can drift, the visual countdown calculates an offset against database time.

During initialization:
```typescript
const localStart = Date.now();
// Fetch current server time (DB NOW())
const serverTime = new Date(dbNowTimestamp).getTime();
const localEnd = Date.now();

// Estimate network latency roundtrip
const rtt = (localEnd - localStart) / 2;

// Offset correction formula
const serverOffset = serverTime - (localEnd - rtt);
```

During each visual render frame:
```typescript
const timeRemaining = endsAtTimestamp - (Date.now() + serverOffset);
const secondsRemaining = Math.max(0, Math.ceil(timeRemaining / 1000));
```

### B. Anti-Sniping Timer Extensions
To prevent sniper bots from bidding in the final fraction of a second, the transaction extends the timer.
If a bid is processed within the database functions:
```sql
-- Extend timer if less than 10 seconds remain
UPDATE room_players
SET ends_at = GREATEST(ends_at, now() + interval '10 seconds')
WHERE id = p_room_player_id;
```
If `ends_at` is 3 seconds away, this updates it to exactly `now() + 10 seconds`. If it is 15 seconds away, it remains unchanged.

### C. Resolution Engine (`check_and_resolve`)
When the visual countdown timer hits zero on any participant's device, the client triggers the `check_and_resolve` RPC function.

```sql
CREATE OR REPLACE FUNCTION check_and_resolve(p_room_id uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rp record;
  v_highest_bid record;
  v_room record;
BEGIN
  -- Lock active player to prevent concurrent check_and_resolve updates
  SELECT * INTO v_rp FROM room_players 
  WHERE room_id = p_room_id AND status = 'ACTIVE' FOR UPDATE;

  IF NOT FOUND THEN
    SELECT status INTO v_room FROM rooms WHERE id = p_room_id;
    RETURN json_build_object('status', v_room.status, 'resolved', false);
  END IF;

  -- Verify expiration
  IF v_rp.ends_at IS NOT NULL AND v_rp.ends_at <= now() THEN
    -- Find highest bid (order by amount DESC, then chronological ASC)
    SELECT * INTO v_highest_bid FROM bids 
    WHERE room_player_id = v_rp.id 
    ORDER BY amount_lakhs DESC, created_at ASC LIMIT 1;

    IF FOUND THEN
      -- Mark player as SOLD
      UPDATE room_players
      SET status = 'SOLD',
          winning_participant_id = v_highest_bid.participant_id,
          sold_price_lakhs = v_highest_bid.amount_lakhs
      WHERE id = v_rp.id;

      -- Deduct funds from winner
      UPDATE room_participants
      SET remaining_budget_lakhs = remaining_budget_lakhs - v_highest_bid.amount_lakhs
      WHERE id = v_highest_bid.participant_id;
    ELSE
      -- Mark player as UNSOLD
      UPDATE room_players SET status = 'UNSOLD' WHERE id = v_rp.id;
    END IF;

    -- Advance order pointer and activate next player
    PERFORM advance_to_next_player(p_room_id);

    SELECT * INTO v_room FROM rooms WHERE id = p_room_id;

    RETURN json_build_object(
      'status', v_room.status,
      'resolved', true,
      'result', CASE WHEN v_highest_bid IS NOT NULL THEN 'SOLD' ELSE 'UNSOLD' END
    );
  END IF;

  -- Not expired
  RETURN json_build_object('status', v_room.status, 'resolved', false);
END;
$$;
```

---

## 🔒 4. Concurrency Controls & Race-Condition Safeguards

The bidding procedure handles multiple requests arriving simultaneously.

### Locking Sequences
Locks are acquired in a strict sequence to avoid deadlocks:
1. **Nomination Lock:** Lock the `room_players` nomination record.
2. **Participant Lock:** Lock the `room_participants` records to prevent budget double-spending.

```sql
CREATE OR REPLACE FUNCTION place_bid(
  p_room_player_id uuid,
  p_participant_id uuid,
  p_amount_lakhs int
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rp record;
  v_room record;
  v_participant record;
  v_current_highest int;
  v_base_price int;
  v_won_count int;
  v_bid_id uuid;
BEGIN
  -- 1. Lock the active player row
  SELECT * INTO v_rp FROM room_players WHERE id = p_room_player_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player not found in auction'; END IF;
  IF v_rp.status != 'ACTIVE' THEN RAISE EXCEPTION 'Player is not active'; END IF;
  IF v_rp.ends_at IS NOT NULL AND v_rp.ends_at <= now() THEN RAISE EXCEPTION 'Bidding has expired'; END IF;

  -- 2. Lock the participant row to avoid budget double-spending
  SELECT * INTO v_participant FROM room_participants WHERE id = p_participant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participant not found'; END IF;

  -- Validate budget
  IF v_participant.remaining_budget_lakhs < p_amount_lakhs THEN
    RAISE EXCEPTION 'Insufficient budget';
  END IF;

  -- Validate bid increments
  SELECT base_price_lakhs INTO v_base_price FROM players WHERE id = v_rp.player_id;
  SELECT max(amount_lakhs) INTO v_current_highest FROM bids WHERE room_player_id = p_room_player_id;

  IF v_current_highest IS NULL THEN
    IF p_amount_lakhs < v_base_price THEN RAISE EXCEPTION 'Bid below base price'; END IF;
  ELSE
    IF p_amount_lakhs <= v_current_highest THEN RAISE EXCEPTION 'Bid must exceed current highest bid'; END IF;
  END IF;

  -- Verify squad sizes
  SELECT * INTO v_room FROM rooms WHERE id = v_rp.room_id;
  SELECT count(*) INTO v_won_count FROM room_players 
  WHERE room_id = v_rp.room_id AND winning_participant_id = p_participant_id AND status = 'SOLD';

  IF v_won_count >= v_room.max_squad_size THEN
    RAISE EXCEPTION 'Squad is full';
  END IF;

  -- Insert bid
  INSERT INTO bids (room_id, room_player_id, participant_id, amount_lakhs)
  VALUES (v_rp.room_id, p_room_player_id, p_participant_id, p_amount_lakhs)
  RETURNING id INTO v_bid_id;

  -- Extend timer
  UPDATE room_players
  SET ends_at = GREATEST(ends_at, now() + interval '10 seconds')
  WHERE id = p_room_player_id;

  RETURN json_build_object('id', v_bid_id, 'amount_lakhs', p_amount_lakhs);
END;
$$;
```

---

## 🧮 5. Dynamic Bid Calculation Matrix

Bidding options are generated dynamically based on player valuations and budgets.

### Increment and Rounding Ranges
The application maps players to four price tiers to calculate appropriate bidding options:

* **Budget ($\le 100\text{L}$):** Increments are $10\%, 20\%, 35\%, 50\%$ of the base price.
* **Mid ($101 - 500\text{L}$):** Increments are $5\%, 10\%, 18\%, 25\%$ of the base price.
* **Premium ($501 - 1500\text{L}$):** Increments are $3\%, 7\%, 11\%, 15\%$ of the base price.
* **Marquee ($> 1500\text{L}$):** Increments are $2\%, 4\%, 7\%, 10\%$ of the base price.

Increments are rounded to prevent uneven bid values:
* Valuations $< 100\text{ Lakhs}$: Round to the nearest multiple of $5\text{L}$
* Valuations $< 500\text{ Lakhs}$: Round to the nearest multiple of $10\text{L}$
* Valuations $< 1000\text{ Lakhs}$: Round to the nearest multiple of $25\text{L}$
* Valuations $\ge 1000\text{ Lakhs}$: Round to the nearest multiple of $50\text{L}$

### Bidding Options Solver Algorithm (`Frontend/src/lib/bidCalculator.ts`)
```typescript
export interface BidOption {
  increment: number;
  total: number;
}

export function computeBidOptions(
  basePrice: number,
  currentHighestBid: number,
  remainingBudget: number,
): BidOption[] {
  const effectiveBid = Math.max(currentHighestBid, basePrice);
  const percentages = getTierPercentages(basePrice); // returns tier array

  const rawIncrements = percentages.map((pct) => {
    const raw = basePrice * pct;
    const rounded = roundToAuctionFriendly(raw);
    return Math.max(5, rounded); // min increment 5L
  });

  // Deduplicate increments
  const seen = new Set<number>();
  const distinctIncrements: number[] = [];
  for (const inc of rawIncrements) {
    if (!seen.has(inc)) {
      seen.add(inc);
      distinctIncrements.push(inc);
    }
  }

  // Fill up to 4 options if duplicates were removed
  if (distinctIncrements.length < 4) {
    const maxInc = distinctIncrements[distinctIncrements.length - 1];
    distinctIncrements.push(roundToAuctionFriendly(maxInc * 1.5));
    distinctIncrements.push(roundToAuctionFriendly(maxInc * 2));
    distinctIncrements.sort((a, b) => a - b);
  }

  const finalIncrements = distinctIncrements.slice(0, 4);
  const options: BidOption[] = [];

  // Filter out options that exceed the participant's budget
  for (const increment of finalIncrements) {
    const total = effectiveBid + increment;
    if (total <= remainingBudget) {
      options.push({ increment, total });
    }
  }

  // Fallback to the minimum increment if options are sparse but budget permits
  if (options.length < 4 && options.length > 0) {
    const minTotal = effectiveBid + 5;
    if (minTotal <= remainingBudget && !options.some((o) => o.total === minTotal)) {
      options.unshift({ increment: 5, total: minTotal });
      options.sort((a, b) => a.total - b.total);
    }
  }

  // Fallback for tight budgets
  if (options.length === 0) {
    const minTotal = effectiveBid + 5;
    if (minTotal <= remainingBudget) {
      options.push({ increment: 5, total: minTotal });
    }
  }

  return options.slice(0, 4);
}
```

---

## 🎨 6. CSS Viewport Constraints & Centering Algorithms

The UI is designed to prevent shifts and layout changes during fast-paced bidding.

### A. Zero-Scroll Viewport Layout
The application locks layout dimensions using CSS configurations:
* **Root Lock:** The parent container is configured with `h-screen overflow-hidden` to prevent browser scrolling.
* **Flex Configurations:** Middle container grids use `flex flex-col min-h-0` to size content dynamically.
* **Component Constraints:** `shrink-0` is applied to static blocks (such as player cards, action timers, and bidding buttons) to ensure scrollable components (like the chat feed) do not push them out of the viewport.

### B. Centered Bid Timeline Centering Algorithm (`Frontend/src/components/auction/BidHistory.tsx`)
Bids are mapped outwards from the center to ensure the latest bid is always highlighted.
```
5 UI Slots: [ Slot 0 ] [ Slot 1 ] [ Slot 2 (Center) ] [ Slot 3 ] [ Slot 4 ]
```
1. Active bids are sorted descending by bid amount.
2. The latest 5 bids are distributed into the array structure:
   * `Slot 2` (Center) $\leftarrow$ Newest Bid (index 0)
   * `Slot 1` (Left) $\leftarrow$ Bid index 1
   * `Slot 3` (Right) $\leftarrow$ Bid index 2
   * `Slot 0` (Far Left) $\leftarrow$ Bid index 3
   * `Slot 4` (Far Right) $\leftarrow$ Bid index 4
3. Empty positions render invisible spacers (`w-20` divs) to keep the display centered.

### C. Design Tokens & Keyframe Animations (`Frontend/src/app/globals.css`)
```css
@theme inline {
  --color-void: #0A0A0F;
  --color-surface: #141419;
  --color-surface-raised: #1C1C24;
  --color-amber: #D4A843;
  --color-amber-glow: #F5C542;
  --color-chalk: #E8E4DC;
  --color-muted: #6B6B7B;
  --color-danger: #E5484D;
  --color-success: #30A46C;
}

@keyframes chip-pop {
  0%   { transform: scale(0.8); opacity: 0; }
  50%  { transform: scale(1.1); }
  100% { transform: scale(1.05); opacity: 1; }
}

@keyframes bid-flash {
  0%   { background-color: rgba(212, 168, 67, 0.3); }
  100% { background-color: transparent; }
}

@utility animate-chip-enter {
  animation: chip-pop 350ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards, bid-flash 600ms ease-out;
}
```

---

## 🔒 7. Row-Level Security (RLS) & Write Policies

* **Catalog Read Actions:** The `players` catalog table allows select actions for all authenticated users.
* **Room Table Subscriptions:** Read operations for `rooms`, `room_players`, `bids`, and `room_chats` are protected via Row-Level Security policies. Select actions are restricted using checking helper functions to prevent RLS recursion:
  ```sql
  is_room_member(room_id)
  ```
  Where `is_room_member` is a `SECURITY DEFINER` function executing a stable query:
  ```sql
  SELECT EXISTS (
    SELECT 1 FROM room_participants
    WHERE room_id = p_room_id
    AND user_id = auth.uid()
  );
  ```
* **Write Restraints:** Direct write actions (INSERT, UPDATE, DELETE) are blocked on all active gaming tables. Modifications are routed through database functions using `SECURITY DEFINER` constraints, which bypass RLS checks to perform updates and validate participants using `auth.uid()`.

---

## 🛠️ 8. Dev Mode & Bypass Testing Configurations

* Start the development server using `npm run dev:test`.
* This sets `NEXT_PUBLIC_DEV_MODE=true` and runs the app on port `3003`.
* In Dev Mode, a "Bypass" button is displayed on the Lobby page, enabling the admin to start the auction with fewer than 3 participants by calling the custom `start_auction_dev` RPC.

---

## 🆕 9. Session Update — v1.3.0 (Supabase Email/Password Auth & RLS Integration)

> The sections above describe the original scaffold and incremental updates. Where they conflict with this section, **this section wins**. See `CHANGELOG.md` for the full list and `Database/supabase/MIGRATIONS.md` for DB apply order.

### 9.1 Identity, Profiles, and Authentication

The identity model has been upgraded to a secure **Supabase Email/Password Authentication** system:
* **Registration & Login:** Handled via a toggle-style auth view at `/auth`. Users sign up or sign in using their email and password.
* **React Context Integration (`AuthProvider.tsx`):** A client-side context wraps the application to track the active session, exposing `user`, `session`, `loading`, and `signOut` properties. It leverages `supabase.auth.onAuthStateChange` to reactively update components on login, logout, or session expiry.
* **Database Syncing (`profiles`):** A new table `profiles` maps user IDs to their metadata:
  ```sql
  CREATE TABLE profiles (
    id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text NOT NULL DEFAULT '',
    created_at   timestamptz NOT NULL DEFAULT now()
  );
  ```
  An database trigger `on_auth_user_created` calls `handle_new_user()` to automatically sync display names on signup.
* **Refactored useLocalUser Hook:** Transitioned from anonymous `localStorage` UUID generation to retrieving `userId` from `AuthProvider`. Room affinity state (`participantId`, `roomId`) is still persisted in `localStorage` (`auction_user`) to keep users aligned with their rosters.

### 9.2 Server-Side Token Refresh (Next.js Middleware)

To maintain session persistence for both Server Components and Client Components, `Frontend/src/middleware.ts` intercept requests:
1. Re-creates the Supabase client using Request/Response headers.
2. Calls `supabase.auth.getUser()` to trigger session and JWT refreshes.
3. Automatically synchronized session cookies back to the client's browser.

### 9.3 RLS Policy Upgrades (Recursion Fix)

To prevent infinite recursion errors when evaluating policies on tables like `room_participants`, a `SECURITY DEFINER` helper function `is_room_member` was introduced:
```sql
CREATE OR REPLACE FUNCTION is_room_member(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM room_participants
    WHERE room_id = p_room_id
    AND user_id = auth.uid()
  );
$$;
```
RLS policies for `room_participants`, `room_players`, `bids`, and `room_chats` utilize `is_room_member(room_id)` to validate access without checking recursively. `rooms` table allows authenticated read access (`USING (true)` for `TO authenticated`) and public discovery reads (`USING (is_public = true AND status = 'LOBBY')` for `TO anon`).

### 9.4 Developer Quick Login (Localhost only)

When running the application with `NEXT_PUBLIC_DEV_MODE=true` on localhost, a quick-login dashboard is displayed at `/auth`. Developers can click any of the buttons to instantly log in or register under pre-seeded test accounts:
* **Predefined Accounts:**
  * `test@test.com` (password: `123789`)
  * `test@test1.com` (password: `123789`)
  * `test@test2.com` (password: `123789`)
  * `test@test3.com` (password: `123789`)
* **Auto-creation:** If these accounts do not exist in the local database, the login handler automatically issues a `signUp` followed by a session redirect.

### 9.5 Homepage Profile Bar & Header Controls

* **Profile Pill:** A glassmorphic top-right profile header is integrated on `/`. It displays the logged-in user's email, a stylized initials avatar, and a `Sign Out` button. When logged out, it provides a clean link to `/auth`.
* **Action Guards:** Route guards redirect unauthenticated users to `/auth` when attempting to access `/create`, `/join`, `/join/[code]`, `/rooms`, and `/room/[id]`.
* **Dynamic CTAs:** The homepage main hero dynamically updates to show "Sign In to Play" when logged out, or "Create Room" / "Join Room" when logged in.

### 9.6 Architecture, Routing, and Components Recap

* **Routing updates:**
  * `/` (hero + tournament selector + profile pill)
  * `/auth` (Sign in / Sign up view, with localhost Dev login buttons)
  * `/rooms` (Rooms hub, with list of Public/My rooms + Sign Out)
  * `/create`, `/join`, `/join/[code]` (All now authenticate users and verify rooms)
* **Realtime Broadcast PubSub:** Uses Supabase client channel listeners to receive PostgreSQL WAL changes (`postgres_changes`) for active bidding tables in real-time.
* **Vercel-Inspired Dark Theme:** All authentication, profile, and room creation cards are styled in the dark polarity-flip system (using `void`, `surface`, `surface-raised` background levels, `hairline` and `hairline-strong` border styles, and `chalk`, `body`, and `mute` fonts).
