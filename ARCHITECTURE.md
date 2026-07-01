# 11Auction — Architecture Document

## Overview

11Auction is an IPL-themed live auction game where 3–5 friends per room bid on ~100 real IPL players, one at a time, with countdown timers, budget constraints, and realtime updates. The backend is built on **Supabase** (PostgreSQL + Realtime + Auth) with a **Next.js** App Router frontend.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL (via Supabase) |
| Identity | No login — per-browser `localStorage` UUID; data access via the Supabase **anon** key |
| Realtime | Supabase Realtime (postgres_changes, `REPLICA IDENTITY FULL`) |
| API | Supabase RPC (Postgres `SECURITY DEFINER` functions) + Next.js API routes |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4 (Vercel-inspired dark system) |
| Hosting | Vercel (frontend) + Supabase Cloud (backend) |

---

## Database Schema

```
┌──────────┐     ┌────────────────────┐     ┌────────────────┐
│ players  │     │ rooms              │     │ room_players   │
│ (catalog)│◄────┤ room_code (unique) │◄────┤ room_id (FK)   │
│          │     │ admin_user_id      │     │ player_id (FK) │
│          │     │ status (enum)      │     │ order_index    │
│          │     │ purse_budget_lakhs │     │ status (enum)  │
│          │     │ bid_timer_seconds  │     │ ends_at        │
│          │     │ is_public (bool)   │     │                │
│          │     │ player_order (text)│     │                │
└──────────┘     └────────┬───────────┘     └───────┬────────┘
                          │                         │
                          │                         │
                 ┌────────┴───────────┐     ┌───────┴────────┐
                 │ room_participants  │     │ bids           │
                 │ room_id (FK)      │◄────┤ room_player_id │
                 │ user_id           │     │ participant_id  │
                 │ display_name      │     │ amount_lakhs   │
                 │ remaining_budget  │     │ created_at     │
                 └───────────────────┘     └────────────────┘
```

### Key Enums

- **`room_status`**: `LOBBY` → `AUCTION` → `PAUSED` ↔ `AUCTION` → `COMPLETED`
- **`auction_player_status`**: `PENDING` → `ACTIVE` → `SOLD` | `UNSOLD`
- **`player_role`**: `Batter`, `Wicketkeeper-Batter`, `All-rounder`, `Pace Bowler`, `Spin Bowler`, `Bowler`

---

## Realtime Strategy

### Hybrid Approach: `postgres_changes` + Client-Triggered Resolution

The system uses **Supabase Realtime postgres_changes** as the primary mechanism for pushing live updates to all connected clients. Each client subscribes to four channels filtered by `room_id`:

| Table | Event | Purpose |
|-------|-------|---------|
| `rooms` | UPDATE | Room status changes (AUCTION → PAUSED, etc.) |
| `room_participants` | * | Player joins, budget changes |
| `room_players` | * | Player activated, sold, unsold |
| `bids` | INSERT | New bids placed |

> **`REPLICA IDENTITY FULL` (important):** all realtime tables are set to
> `REPLICA IDENTITY FULL` (see `006_realtime_fix.sql`). With RLS enabled,
> Supabase Realtime needs the full row image to authorize and emit `UPDATE`
> events — without it, the `room_participants` budget deduction was delivered
> to some clients (e.g. the admin) but not all. The client (`useRoom`) also
> reconciles the **full snapshot** on every realtime signal, so because every
> auction resolution updates the `rooms` row, all participants' budgets always
> re-sync after each sale even if a single table event is missed.

### Why Not Broadcast?

Broadcast channels are considered but not used as the primary transport because:
1. `postgres_changes` is authoritative — events reflect actual DB state
2. No need for a separate event bus when DB changes _are_ the events
3. Broadcast could supplement for ephemeral UI state (typing indicators, etc.) in future

---

## Timer & Resolution Strategy

### The Problem

Countdown timers (30s per player) must be resolved server-side to prevent cheating, but Supabase doesn't have persistent server-side timers.

### The Solution: Dual-Layer Resolution

```
┌─────────────────────────┐
│   Client-Side Timer     │  ← Visual countdown (cosmetic)
│   (JavaScript setInterval)│
└────────┬────────────────┘
         │ Timer hits 0
         ▼
┌─────────────────────────┐
│   check_and_resolve()   │  ← Client calls RPC when timer expires
│   (Supabase RPC)        │     Server validates ends_at <= NOW()
└─────────────────────────┘
         │ If no client calls...
         ▼
┌─────────────────────────┐
│   pg_cron (every 1 min) │  ← Safety net for orphaned auctions
│   resolve_expired_      │     Catches disconnected rooms
│   auctions()            │
└─────────────────────────┘
```

1. **Client-side**: Each client runs a local countdown. When it hits 0, the client calls `check_and_resolve(room_id)`.
2. **Server-side validation**: The function checks `ends_at <= NOW()` before resolving — the actual timestamp is authoritative, not the client's timer.
3. **pg_cron safety net**: Every minute, `resolve_expired_auctions()` sweeps for any `ACTIVE` room_players with `ends_at <= NOW()` that weren't resolved by client calls. This handles scenarios where all clients disconnect.

### Timer Extension on Bids

When a bid is placed with less than 10 seconds remaining, the timer extends:
```sql
UPDATE room_players
SET ends_at = GREATEST(ends_at, now() + interval '10 seconds')
WHERE id = p_room_player_id;
```
This prevents last-second sniping and gives others a fair chance to counter-bid.

---

## Concurrency Safety

### SELECT FOR UPDATE

The `place_bid()` function uses explicit row-level locks to prevent race conditions:

```sql
-- Lock the room_player row (prevents concurrent resolution)
SELECT * INTO v_rp FROM room_players WHERE id = p_room_player_id FOR UPDATE;

-- Lock the participant row (prevents concurrent budget overspend)
SELECT * INTO v_participant FROM room_participants WHERE id = p_participant_id FOR UPDATE;
```

### What This Prevents

1. **Double-spend**: Two bids for the same participant processing simultaneously, each seeing sufficient budget
2. **Race resolution**: A bid being placed at the exact moment the timer expires
3. **Ghost bids**: A bid being recorded after the player is already SOLD

### Idempotency

`resolve_expired_auctions()` is idempotent — it only processes `ACTIVE` players with `ends_at <= NOW()`. Once resolved (status → SOLD/UNSOLD), subsequent calls skip them.

---

## Row-Level Security (RLS) Model

This app uses **Supabase Email/Password Authentication** to secure room membership and gaming transactions. Every write transaction is initiated via `SECURITY DEFINER` RPC functions that execute operations on behalf of the active user session. Reads are restricted to room participants using RLS policies.

| Table | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|---------------------|
| `players` | `authenticated` / `anon` (`USING (true)`) | None (seed data only) |
| `rooms` | `authenticated` / `anon` (if public and status = 'LOBBY') | Via SECURITY DEFINER RPCs only |
| `room_participants` | `authenticated` (`is_room_member(room_id)`) | Via SECURITY DEFINER RPCs only |
| `room_players` | `authenticated` (`is_room_member(room_id)`) | Via SECURITY DEFINER RPCs only |
| `bids` | `authenticated` (`is_room_member(room_id)`) | Via SECURITY DEFINER RPCs only |
| `room_chats` | `authenticated` (`is_room_member(room_id)`) | Via `send_chat` RPC |
| `profiles` | `authenticated` (`id = auth.uid()`) | Via signup trigger / own update only |

### Recursive Policy Bypass Helper

To avoid infinite recursion when querying `room_participants` from within policies, the RLS rules utilize a helper function defined with `SECURITY DEFINER`:

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

### Access control and privacy

* **Public vs private** (`rooms.is_public`): `listPublicRooms()` only returns public, open (`LOBBY`) rooms, so private rooms are not discoverable.
* **Link-tamper guard:** A non-participant who opens `/room/{id}` directly is only offered a Join action (and shown the room code) for **public, joinable** rooms. Private rooms show "you need an invite link" and never expose the join CTA — so you can't join a private room by guessing/altering the URL.
* **Auth Guards:** Route/action guards direct unauthenticated users to `/auth` when attempting to access `/create`, `/join`, `/join/[code]`, `/rooms`, and `/room/[id]`.
* **Profiles Sync:** When a user registers, an database trigger `on_auth_user_created` calls a `SECURITY DEFINER` function `handle_new_user()` to automatically insert a corresponding row in the public `profiles` table.

All write operations still go through `SECURITY DEFINER` functions that enforce business rules (admin validation, budget checks, timer validation, etc.).


---

## Player Ordering Algorithm

When the auction starts, `seed_room_players(room_id, strategy)` populates
`room_players` with an `order_index` using the room's `player_order`:

- **`RANDOM`** — a pure `ORDER BY random()` shuffle of all players.
- **`CATEGORY`** ("high-dopamine") — players are split into tiers by rating
  (`top+medium` = `rating >= 6`, `low` = `rating < 6`), each tier shuffled
  independently, then **weighted-interleaved**: each slot is drawn ~**75%** from
  the top+medium pool and ~**25%** from the low pool until one runs out, then the
  other drains. This keeps star/key players sprinkled throughout the auction
  (never clustered) and, because both pools are reshuffled per game, the order
  **never repeats**.

`start_auction()` and `start_auction_dev()` both call this builder.

---

## API Design

### RPC Functions (Primary API)

| Function | Caller | Purpose |
|----------|--------|---------|
| `create_room()` | Any user | Create room (incl. `is_public`, `player_order`) + auto-join as admin |
| `join_room()` | Any user | Join an existing LOBBY room |
| `start_auction()` | Room admin only | Build player order (via `seed_room_players`), start first player |
| `start_auction_dev()` | Room admin only | Same as above but skips the 2-participant minimum (dev) |
| `seed_room_players()` | Internal | Populate `room_players` order (`RANDOM` / `CATEGORY`) |
| `place_bid()` | Room participants | Place a bid on the active player |
| `check_and_resolve()` | Any room member | Client-triggered timer resolution |
| `resolve_expired_auctions()` | pg_cron | Safety-net sweep for orphaned auctions |
| `pause_auction()` | Room admin only | Pause with remaining time saved |
| `resume_auction()` | Room admin only | Resume with saved time restored |
| `force_resolve_current_player()` | Room admin only | Skip current player (admin override) |
| `end_auction_early()` | Room admin only | End auction, mark remaining as UNSOLD |
| `send_chat()` | Room participants | Post a chat message |

### Client read helpers (`Frontend/src/lib/api.ts`)

Direct `anon` SELECTs (not RPCs): `getRoomSnapshot()`, `getRoomResults()`,
`getRoomChats()`, and discovery — `listPublicRooms()` (public LOBBY rooms with
participant counts) and `listMyRooms(userId)` (rooms the user has joined).

### Next.js API Routes (SSR Wrappers)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/rooms` | POST | Create room (server-side) |
| `/api/rooms/[id]` | GET | Get full room snapshot |

---

## Budget & Squad Constraints

- **Purse budget**: Chosen at creation from fixed options — ₹100 / 150 / 200 / 250 Cr (10000–25000 lakhs)
- **Max squad size**: Chosen from fixed options — 10 / 15 / 20 / 25
- **Bid timer**: Chosen from fixed options — 10 / 15 / 20 / 25 / 30s
- **Budget validation**: Checked against `remaining_budget_lakhs` at bid time
- **Budget deduction**: Happens atomically when a player is resolved as SOLD
- **Squad size check**: Count of SOLD players for that participant < max_squad_size

---

## Known Limitations

1. **Clock Drift**: Client-side timers may drift from server time. The `getTimeRemaining()` utility accepts a `serverOffset` parameter for correction, but perfect sync requires additional NTP-like coordination.

2. **pg_cron Granularity**: The safety net runs every 60 seconds, meaning a disconnected room's auction could stall for up to 60 seconds before auto-resolution kicks in.

3. **No Bid Retraction**: Once placed, bids cannot be retracted. This is by design (matches real auction behavior).

4. **Single Active Player**: Only one player is auctioned at a time. There's no parallel bidding.

5. **No Reconnection State Sync**: If a client disconnects and reconnects, it must fetch the full snapshot via `getRoomSnapshot()`. There's no incremental sync mechanism.

6. **Realtime Payload Size**: Supabase postgres_changes sends the full row on UPDATE. For large rooms with many players, the `room_players` table updates could generate significant payload traffic.

7. **No Rate Limiting**: Bid spam is not rate-limited at the DB level. Consider adding application-level rate limiting for production use.

8. **Room Cleanup**: There's no automatic cleanup of abandoned rooms. Consider adding a pg_cron job to delete LOBBY rooms older than 24 hours.

---

## File Structure

```
11auc/
├── Frontend/                        # Next.js app
│   ├── src/
│   │   ├── lib/
│   │   │   ├── types.ts             # TypeScript interfaces
│   │   │   ├── api.ts               # Client-side RPC service
│   │   │   ├── utils.ts             # Price formatting, timer helpers
│   │   │   └── supabase/
│   │   │       ├── client.ts        # Browser client (singleton)
│   │   │       ├── server.ts        # Server client (cookies)
│   │   │       └── realtime.ts      # Realtime subscription helpers
│   │   └── app/
│   │       └── api/
│   │           └── rooms/
│   │               ├── route.ts     # POST: create room
│   │               └── [id]/
│   │                   └── route.ts # GET: room snapshot
│   ├── package.json                 # Next.js dependencies
│   ├── tsconfig.json                # TypeScript config
│   ├── next.config.ts               # Next.js config
│   └── .env.example                 # Environment variables template
├── Backend/                         # Supabase Edge Functions / API
│   └── ...
├── Database/
│   ├── supabase/
│   │   ├── migrations/
│   │   │   ├── 001_schema.sql       # Tables, enums, indexes
│   │   │   ├── 002_rls_policies.sql # Row-level security
│   │   │   ├── 003_functions.sql    # RPC functions
│   │   │   └── 004_cron.sql         # pg_cron safety net
│   │   └── seed.sql                 # Player catalog data
│   └── data-extraction/             # Player dataset tooling
│       └── ...
└── ARCHITECTURE.md                  # This file
```
