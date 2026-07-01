# 🏏 Hire.md — Deep Technical Interview Study Guide & Project Blueprint

## SECTION 24 — GEMINI CLI USAGE INSTRUCTIONS

To load this file into the Gemini CLI for interactive technical interview practice and roleplay sessions, run the following command in your terminal:

```bash
gemini -p "$(cat Hire.md)"
```

**What this does:**
This command uses the shell command substitution syntax `$(cat Hire.md)` to read the entire contents of the `Hire.md` file and pass it as the string argument for the `-p` (prompt) flag of the `gemini` CLI tool. This instantly initializes the Gemini LLM context with this complete project guide, equipping the assistant to act as a technically precise mock interviewer or code reviewer.

### Recommended Practice Prompts:
1. **System Design Roleplay:** *"Roleplay as a Principal Engineer at Supabase. Ask me 3 challenging questions about the realtime sync architecture and the `REPLICA IDENTITY FULL` configuration I chose for 11Auction, then evaluate my answers."*
2. **Concurrency & Locking Drill:** *"Grill me on database locking and concurrency. Walk through a scenario where three users submit a bid on the same player at the same millisecond. Ask me to explain how `place_bid()` resolves this, down to the PostgreSQL lock types and row states."*
3. **Refactoring Simulation:** *"Act as a Frontend System Architect. Let's discuss refactoring the visual timer and client-side resolution loop. What issues does the current dual-layer `check_and_resolve` RPC + `pg_cron` setup have, and how could we improve clock sync? Ask me to walk through the trade-offs."*

---

## Files Not Found
* `Database/supabase/migrations/005_chat.sql` (Note: The chat schema migration exists as `Database/supabase/005_chat.sql` directly in the `Database/supabase/` folder, not under the `Database/supabase/migrations/` sub-directory).

---

## SECTION 1 — ELEVATOR PITCH

11Auction is a high-fidelity, real-time multiplayer cricket auction web application that allows groups of 3–5 users to experience a live sports bidding environment on ~90 real IPL cricketers under purse budget and squad limits. The application is built on Next.js 16 (App Router), React 19, and Tailwind CSS v4, wrapped in a polished, Vercel-inspired dark design system. The backend is completely serverless, using a Supabase Cloud PostgreSQL database, utilizing Supabase Realtime Channels (`postgres_changes`) for millisecond-level state sync, and Supabase Email/Password Authentication for session security. Bidding and game progression are controlled by transactional PostgreSQL database functions (`SECURITY DEFINER` RPCs) that enforce rules atomically. The frontend is hosted on Vercel, and the backend is deployed on Supabase Cloud.

---

## SECTION 2 — WHY THIS PROJECT

### Why did you choose this project for the assignment?
I chose this project because it represents a demanding test of building a fully serverless, real-time state machine without a persistent Node.js websocket server. Live auction environments require absolute data integrity, sub-second latency, and rigid transaction safety. Implementing features like countdown timers, budget constraints, and active participant changes using only PostgreSQL, Supabase, and Next.js allowed me to push the boundaries of serverless architecture and postgres-native sync.

### What was the hardest problem you had to solve?
The hardest problem was preventing RLS (Row-Level Security) infinite recursion on the `room_participants` table when policies tried to check room membership, while simultaneously solving the "admin-only updates" sync glitch. Because evaluating if a user belongs to a room requires querying `room_participants`, writing a standard subquery policy caused PostgreSQL to loop indefinitely. I resolved this by extracting the lookup into a `SECURITY DEFINER` helper function `is_room_member(room_id)` that executes with owner privileges to bypass RLS recursion, combined with setting `REPLICA IDENTITY FULL` on all database tables so that Supabase Realtime could authorize and broadcast budget updates to all clients instead of only the record owner.

### What would you do differently with more time?
With more time, I would replace the polling-based `pg_cron` safety-net sweeper with a dedicated redis-backed queue or pg-boss scheduler to resolve timers. While `pg_cron` works as an excellent safety net for orphaned rooms, its 60-second minimum granularity means a disconnected room may stall for up to a minute before the active player is marked UNSOLD. Introducing a dedicated job runner would allow scheduling exact, single-shot resolutions down to the millisecond, completely decoupling the system from client-triggered RPC checkins.

---

## SECTION 3 — TECH STACK (with justification)

| Technology | Version | What it does in this project | Why it was chosen over alternatives |
|---|---|---|---|
| **Next.js** | `16.2.9` | App Router frontend framework, server-side page routing, and Next.js SSR API wrappers. | Chosen over Vite/React SPA to leverage Server Components, Server Actions, and native Middleware for robust, server-side Supabase cookie validation. |
| **React** | `19.2.4` | Component-driven UI rendering, state management, and real-time subscription lifecycle. | Chosen because of its declarative rendering model, optimized ref-handling, and compatibility with Next.js 16. |
| **TypeScript** | `^5` | Static typing for entities (Rooms, Players, Bids, Chats) and strict prop typing. | Chosen over JavaScript to prevent type regression, validate RPC payloads, and establish compile-time safety. |
| **Tailwind CSS** | `^4` | High-fidelity Vercel-inspired dark styling, atmospheric mesh gradients, and layouts. | Version 4 was chosen for its performance, CSS-native imports, inline `@theme` tokens, and utility classes that bypass standard CSS bloat. |
| **Supabase Client** | `^2.108.2` | Client-side SDK connecting to Supabase storage, real-time subscriptions, and DB. | Chosen over native WebSockets and fetch calls due to its out-of-the-box support for Supabase Auth, client-side RPC execution, and auto-reconciliation. |
| **Supabase SSR** | `^0.12.0` | Server-side cookie and session storage controller for App Router environment. | Chosen over manual JWT header tracking to handle cookie-based authentication inside middleware, layouts, and route handlers. |
| **PostgreSQL** | Cloud | Core relational database hosted on Supabase, handling locking and trigger events. | Chosen over MongoDB or DynamoDB because transactional features (ACID guarantees, `SELECT FOR UPDATE`, triggers) are vital for bidding integrity. |
| **Supabase Realtime** | Cloud | WebSockets client receiving WAL (Write-Ahead Log) change broadcasts. | Chosen over Socket.io or Pusher to allow direct synchronization of database changes with zero server infrastructure. |
| **Supabase Auth** | Cloud | User authentication system using secure Email/Password registration. | Chosen over custom OAuth or OAuth providers (Google, GitHub) to keep the registration loop minimal, quick, and self-contained. |
| **pg_cron** | v1.x (PG Ext) | Database scheduler trigger executing sweeps on active auctions. | Chosen over node-cron or external cron pingers to run timer safety nets directly inside the database engine. |
| **Vercel** | Cloud | Edge deployment and compilation pipeline hosting the Next.js frontend. | Chosen for its performance, CD pipeline integration with GitHub, and optimal support for Next.js features. |

---

## SECTION 4 — FULL DATABASE SCHEMA

### Database Enums
*   `room_status`: `'LOBBY'`, `'AUCTION'`, `'PAUSED'`, `'COMPLETED'`
*   `auction_player_status`: `'PENDING'`, `'ACTIVE'`, `'SOLD'`, `'UNSOLD'`
*   `player_role`: `'Batter'`, `'Wicketkeeper-Batter'`, `'All-rounder'`, `'Pace Bowler'`, `'Spin Bowler'`, `'Bowler'`

---

### Tables

#### 1. `players` (Static Catalog Table)
*   `id` (`uuid`, PRIMARY KEY, DEFAULT `gen_random_uuid()`): Unique player ID.
*   `team_name` (`text`, NOT NULL): IPL franchise catalog association (e.g. 'RCB').
*   `player_name` (`text`, NOT NULL): Full name of the cricketer.
*   `player_img_url` (`text`, NULL): URL to the headshot thumbnail image.
*   `player_expert_in` (`player_role`, NOT NULL): Specific field of play.
*   `nationality` (`text`, NOT NULL): Cricketer country of origin.
*   `experience_years` (`int`, NOT NULL, DEFAULT `0`): Years of experience.
*   `base_price_lakhs` (`int`, NOT NULL): Starting bid value in lakhs.
*   `base_price_display` (`text`, NOT NULL): Human-readable price (e.g. '₹21 Cr').
*   `rating` (`decimal(3,1)`, NULL): Rating out of 10.0.

#### 2. `rooms`
*   `id` (`uuid`, PRIMARY KEY, DEFAULT `gen_random_uuid()`): Unique room ID.
*   `room_code` (`varchar(6)`, UNIQUE, NOT NULL): 6-character uppercase alphanumeric code.
*   `room_name` (`text`, NOT NULL): Human-readable room title.
*   `admin_user_id` (`uuid`, NOT NULL): Supabase user ID of the creator.
*   `status` (`room_status`, NOT NULL, DEFAULT `'LOBBY'`): Phase of the room.
*   `purse_budget_lakhs` (`int`, NOT NULL, DEFAULT `12000`): Budget cap in lakhs.
*   `max_squad_size` (`int`, NOT NULL, DEFAULT `18`): Max players a squad can win.
*   `bid_timer_seconds` (`int`, NOT NULL, DEFAULT `30`): Round timer duration.
*   `current_player_order_index` (`int`, NULL): Order index of the current active player.
*   `is_public` (`boolean`, NOT NULL, DEFAULT `true`): If discoverable on public lists.
*   `player_order` (`text`, NOT NULL, DEFAULT `'RANDOM'`): Strategy ('RANDOM' or 'CATEGORY').
*   `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`): Creation date.
*   *Constraints:* `rooms_player_order_chk` CHECK (player_order IN ('RANDOM', 'CATEGORY')).

#### 3. `room_participants`
*   `id` (`uuid`, PRIMARY KEY, DEFAULT `gen_random_uuid()`): Unique participant ID.
*   `room_id` (`uuid`, NOT NULL, FK): Link to `rooms.id` (ON DELETE CASCADE).
*   `user_id` (`uuid`, NOT NULL): Link to `auth.users.id`.
*   `display_name` (`text`, NOT NULL): Custom user screen name.
*   `squad_name` (`text`, NOT NULL): Custom team name.
*   `remaining_budget_lakhs` (`int`, NOT NULL): Available budget in lakhs.
*   `joined_at` (`timestamptz`, NOT NULL, DEFAULT `now()`): Joining timestamp.
*   *Indexes/Constraints:* UNIQUE(room_id, user_id).

#### 4. `room_players`
*   `id` (`uuid`, PRIMARY KEY, DEFAULT `gen_random_uuid()`): Unique game-player instance ID.
*   `room_id` (`uuid`, NOT NULL, FK): Link to `rooms.id` (ON DELETE CASCADE).
*   `player_id` (`uuid`, NOT NULL, FK): Link to `players.id`.
*   `order_index` (`int`, NOT NULL): Ordering index for sequencing.
*   `status` (`auction_player_status`, NOT NULL, DEFAULT `'PENDING'`): Current auction status.
*   `winning_participant_id` (`uuid`, NULL, FK): Link to `room_participants.id`.
*   `sold_price_lakhs` (`int`, NULL): Winning bid price in lakhs.
*   `ends_at` (`timestamptz`, NULL): Time when current active round closes.
*   `remaining_seconds_on_pause` (`int`, NULL): Seconds remaining if paused.
*   *Indexes/Constraints:* UNIQUE(room_id, player_id).

#### 5. `bids`
*   `id` (`uuid`, PRIMARY KEY, DEFAULT `gen_random_uuid()`): Unique bid transaction ID.
*   `room_id` (`uuid`, NOT NULL, FK): Link to `rooms.id` (ON DELETE CASCADE).
*   `room_player_id` (`uuid`, NOT NULL, FK): Link to `room_players.id` (ON DELETE CASCADE).
*   `participant_id` (`uuid`, NOT NULL, FK): Link to `room_participants.id` (ON DELETE CASCADE).
*   `amount_lakhs` (`int`, NOT NULL): Bid value in lakhs.
*   `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`): Timestamp of the bid.

#### 6. `room_chats`
*   `id` (`uuid`, PRIMARY KEY, DEFAULT `gen_random_uuid()`): Unique chat message ID.
*   `room_id` (`uuid`, NOT NULL, FK): Link to `rooms.id` (ON DELETE CASCADE).
*   `participant_id` (`uuid`, NOT NULL, FK): Link to `room_participants.id` (ON DELETE CASCADE).
*   `message` (`text`, NOT NULL): Text message content.
*   `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`): Message creation timestamp.

#### 7. `profiles`
*   `id` (`uuid`, PRIMARY KEY, FK): Link to `auth.users.id` (ON DELETE CASCADE).
*   `display_name` (`text`, NOT NULL, DEFAULT `''`): Display name.
*   `created_at` (`timestamptz`, NOT NULL, DEFAULT `now()`): Creation date.

---

### Database Indexes
*   `idx_rooms_room_code` ON `rooms` (`room_code`)
*   `idx_room_participants_room_id` ON `room_participants` (`room_id`)
*   `idx_room_participants_user_id` ON `room_participants` (`user_id`)
*   `idx_room_players_room_id` ON `room_players` (`room_id`)
*   `idx_room_players_player_id` ON `room_players` (`player_id`)
*   `idx_room_players_room_status` ON `room_players` (`room_id`, `status`)
*   `idx_bids_room_id` ON `bids` (`room_id`)
*   `idx_bids_room_player_id` ON `bids` (`room_player_id`)
*   `idx_bids_participant_id` ON `bids` (`participant_id`)
*   `idx_bids_room_player_amount` ON `bids` (`room_player_id`, `amount_lakhs` DESC)
*   `idx_room_chats_room_id` ON `room_chats` (`room_id`)
*   `idx_room_chats_created_at` ON `room_chats` (`room_id`, `created_at`)

---

### ASCII Entity-Relationship Diagram

```text
  ┌────────────────────────────────────────────────────────┐
  │                      auth.users                        │
  └──────────────────────────┬─────────────────────────────┘
                             │ (1:1)
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │                       profiles                         │
  └────────────────────────────────────────────────────────┘
                             │ (1:many)
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │                        rooms                           │
  └──────┬───────────────────┬──────────────────────┬──────┘
         │ (1:many)          │ (1:many)             │ (1:many)
         ▼                   ▼                      ▼
  ┌──────────────┐    ┌──────────────┐       ┌──────────────┐
  │Participants  ├─┐  │ RoomPlayers  │◄──────┤   Players    │
  └──────┬───────┘ │  └──────┬───────┘ (many:1)(Catalog)   │
         │         │         │               └──────────────┘
         │         │         │ (1:many)
         │         │         ▼
         │         │  ┌──────────────┐
         │         └─►│     Bids     │
         │            └──────────────┘
         │ (1:many)
         ▼
  ┌──────────────┐
  │  RoomChats   │
  └──────────────┘
```

**What this does:**
This entity relationship diagram maps how data tables associate with one another in PostgreSQL. It illustrates that `rooms` have a one-to-many relationship with `room_participants`, `room_players`, and `room_chats`. User identities in `auth.users` map directly one-to-one with the public `profiles` records. Players in the static catalog table `players` are mapped one-to-many with their active session states inside `room_players`, which in turn join one-to-many with incoming `bids`.

---

## SECTION 5 — REALTIME ARCHITECTURE

### Channels, Subscriptions, and Filters
The frontend uses the `subscribeToRoom` function in `Frontend/src/lib/supabase/realtime.ts` to establish a WebSocket channel using the Supabase client. The channel is named `room:${roomId}`. It listens for `postgres_changes` on the following tables:
1.  **`rooms`**: Listens only for `UPDATE` events, filtered by `id=eq.${roomId}`.
2.  **`room_participants`**: Listens for `*` (INSERT, UPDATE, DELETE) events, filtered by `room_id=eq.${roomId}`.
3.  **`room_players`**: Listens for `*` events, filtered by `room_id=eq.${roomId}`.
4.  **`bids`**: Listens only for `INSERT` events, filtered by `room_id=eq.${roomId}`.
5.  **`room_chats`**: Listens only for `INSERT` events, filtered by `room_id=eq.${roomId}` (subscribed inside `ChatPanel.tsx` under channel name `room-chats-${roomId}`).

### Client-Side Action on Events (`useRoom.ts`)
*   **`onRoomUpdate`**: Patches the local `snapshot.room` state immediately for UI responsiveness, then calls the async helper `fetchSnapshot()` to fetch the full snapshot from `/api/rooms/[id]`. Re-fetching the full snapshot ensures participant budgets, squads, and counts are synchronized even if intermediate row updates are missed.
*   **`onParticipantChange`**: Triggers `fetchSnapshot()` to fetch participant records and update budgets.
*   **`onRoomPlayerChange`**: Triggers `fetchSnapshot()` to get updated player statuses.
*   **`onNewBid`**: Triggers `fetchSnapshot()` to update the active bidding list.

### Why `REPLICA IDENTITY FULL` is Needed
By default, PostgreSQL tables write only the primary key to the WAL (Write-Ahead Log) during `UPDATE` or `DELETE` events. However, because Row-Level Security (RLS) is enabled, the Supabase Realtime router must read the fields of the modified row to determine if a subscriber has access to it. Setting `ALTER TABLE {table_name} REPLICA IDENTITY FULL` forces PostgreSQL to log the entire row image in the WAL. Without this, when `room_participants` is updated, the update is blocked by the Realtime engine and is not delivered to non-admin subscribers, resulting in budgets not updating live.

### Why `postgres_changes` Over Supabase Broadcast
`postgres_changes` was chosen because it is database-authoritative. Broadcast is an ephemeral, client-sent fire-and-forget channel. Because the game relies on strict transaction validation, the database state must remain the single source of truth. Bypassing database events could lead to desynchronization between what the client displays and what the database has recorded.

### Data Flow for a Bid
```text
Client places bid ──► calls RPC place_bid() ──► Row locked (FOR UPDATE) & checked
                                                          │
   Client UI Updates ◄── Realtime Message ◄── Committed to WAL ◄── Bid Inserted
```

**What this does:**
This flow diagram maps the full lifecycle of a bidding action. The client executes the `place_bid()` RPC, sending the target room player ID, the participant ID, and the bid amount. The database immediately opens a transaction, locking the corresponding rows. If validations pass, a new record is written to the `bids` table, generating a WAL entry. Supabase Realtime notices this change in the WAL and broadcasts the new bid payload to all clients subscribed to the room's WebSocket channel, triggering a local state update on their screens.

---

## SECTION 6 — TIMER AND RESOLUTION STRATEGY

### Client-Side Timer (`useTimer.ts`)
The client uses the `useTimer` hook which triggers `requestAnimationFrame` (RAF) for sub-millisecond precision.
*   **Progress Math**: It computes `remaining = Math.max(0, (endTime - Date.now()) / 1000)`. It then sets progress as `Math.min(1, remaining / totalDurationRef.current)`.
*   **State updates**: Sets `secondsRemaining` as `Math.ceil(remaining)`.
*   **Cleanup**: Clears the animation frame on unmount or when `endsAt` changes.

### DB-Level `check_and_resolve()`
`check_and_resolve()` locks the active player row (`FOR UPDATE`) in `room_players`. It then checks if `v_rp.ends_at <= now()`. If expired:
1.  It queries the highest bid: `SELECT * FROM bids WHERE room_player_id = v_rp.id ORDER BY amount_lakhs DESC LIMIT 1`.
2.  If a bid exists: Sets player status to `'SOLD'`, links `winning_participant_id` and `sold_price_lakhs`, and deducts `amount_lakhs` from `room_participants.remaining_budget_lakhs`.
3.  If no bids exist: Sets player status to `'UNSOLD'`.
4.  Calls `advance_to_next_player(p_room_id)` to set the next pending player to `'ACTIVE'`.

### safety Net: `pg_cron`
If a client timer runs out but the client disconnects before triggering the RPC, `resolve_expired_auctions()` is scheduled via `pg_cron`:
*   **Cron Schedule**: `* * * * *` (every minute).
*   **Execution**: `SELECT public.resolve_expired_auctions()`.
*   **Sweep query**: Loops over all `room_players` where `status = 'ACTIVE' AND ends_at <= now() FOR UPDATE` and resolves them.

### Anti-Sniping Protection
In `place_bid()`, when a bid is successfully placed, the timer is extended if less than 10 seconds remain:
```sql
UPDATE room_players
SET ends_at = GREATEST(ends_at, now() + interval '10 seconds')
WHERE id = p_room_player_id;
```

**What this does:**
This SQL statement updates the `ends_at` timestamp for the active cricketer round in the `room_players` table. It takes the maximum value between the current `ends_at` value and a timestamp 10 seconds in the future (`now() + interval '10 seconds'`). By updating `ends_at` dynamically if a bid is placed in the final seconds of a round, it extends the bidding window to prevent automated "sniping" scripts from winning the player without giving other participants a chance to counter-bid.

### Simultaneous Execution Protection
If two clients call `check_and_resolve()` simultaneously, the first caller locks the active player row via `FOR UPDATE` inside the database transaction. The second caller's transaction is blocked until the first caller's transaction commits. Once the first caller commits, the row status changes from `'ACTIVE'` to `'SOLD'` or `'UNSOLD'`. The second caller's execution resumes, checks the row, sees the status is no longer `'ACTIVE'`, and returns immediately with `resolved: false` without modifying the state.

---

## SECTION 7 — CONCURRENCY AND RACE CONDITIONS

### `place_bid()` Locking Sequence
The database function locks rows sequentially using `FOR UPDATE` to prevent race conditions:
1.  **Lock Room Player**:
    ```sql
    SELECT * INTO v_rp FROM room_players WHERE id = p_room_player_id FOR UPDATE;
    ```

**What this does:**
This queries the active player record from `room_players` matching the provided ID and stores the row details into the local variable `v_rp`. By appending `FOR UPDATE`, it places an exclusive row-level lock on that specific record. Any other database query attempting to update or select this same player row with `FOR UPDATE` will block until this transaction completes.

2.  **Lock Participant**:
    ```sql
    SELECT * INTO v_participant FROM room_participants WHERE id = p_participant_id FOR UPDATE;
    ```

**What this does:**
This queries the participant's budget and squad status from `room_participants` into the variable `v_participant` while acquiring an exclusive row-level lock using `FOR UPDATE`. This prevents concurrent transactions from modifying the participant's remaining budget or won player counts, ensuring budget checks are performed against consistent and locked data.

### Locked Rows Rationale
*   **`room_players`**: Locked to prevent another transaction from calling `check_and_resolve()` or `force_resolve_current_player()` at the same time. This prevents bids from being placed after a player is marked SOLD.
*   **`room_participants`**: Locked to ensure the participant's budget is read and updated atomically. This prevents two concurrent bids from exceeding the participant's remaining budget.

### Validation Checks in `place_bid()`
1.  Checks if the room player exists.
2.  Verifies the player is active: `v_rp.status = 'ACTIVE'`.
3.  Verifies the bidding window is open: `v_rp.ends_at > now()`.
4.  Fetches `base_price_lakhs` from `players`.
5.  Fetches `max(amount_lakhs)` from `bids` for this player.
6.  If it is the first bid, checks if the bid is at least the base price: `p_amount_lakhs >= v_base_price`.
7.  If it is a subsequent bid, checks if the bid is higher than the current highest bid: `p_amount_lakhs > v_current_highest`.
8.  Verifies the participant exists.
9.  Verifies the participant has sufficient budget: `v_participant.remaining_budget_lakhs >= p_amount_lakhs`.
10. Fetches `rooms.max_squad_size`.
11. Counts players won by the participant: `status = 'SOLD'`. Verifies the squad is not full: `v_won_count < v_room.max_squad_size`.

### Handling Concurrent Requests
While transaction A holds the locks, transaction B is blocked on its `SELECT ... FOR UPDATE` statement. It waits until transaction A commits or rolls back. Once transaction A commits, transaction B resumes, reads the updated state (e.g. the new highest bid), and fails validation (raising an exception because its bid is no longer higher than the new highest bid).

### Preventing Ghost Bids
The check `IF v_rp.ends_at <= now()` or `IF v_rp.status != 'ACTIVE'` raises an exception immediately. Because the active player row is locked first, no transaction can insert a bid after the player's status has changed or the timer has expired.

### Preventing Double-Spending
By locking the `room_participants` row `FOR UPDATE`, all checks on `remaining_budget_lakhs` are serialized. This prevents concurrent bid evaluations from executing concurrently on the same budget.

---

## SECTION 8 — SECURITY MODEL (RLS + Auth)

### RLS Policies

#### `rooms`
*   `SELECT` (authenticated): `USING (true)` (allows any logged-in user to view all rooms).
*   `SELECT` (anonymous): `USING (is_public = true AND status = 'LOBBY')` (allows public rooms to be discoverable before login).
*   `INSERT/UPDATE/DELETE`: Blocked. Writes are restricted to `SECURITY DEFINER` RPCs.

#### `room_participants`
*   `SELECT` (authenticated): `USING (is_room_member(room_id))` (restricts viewing to members of the room).
*   `INSERT/UPDATE/DELETE`: Blocked.

#### `room_players`
*   `SELECT` (authenticated): `USING (is_room_member(room_id))`.
*   `INSERT/UPDATE/DELETE`: Blocked.

#### `bids`
*   `SELECT` (authenticated): `USING (is_room_member(room_id))`.
*   `INSERT/UPDATE/DELETE`: Blocked.

#### `players`
*   `SELECT` (authenticated / anonymous): `USING (true)`.
*   `INSERT/UPDATE/DELETE`: Blocked.

#### `profiles`
*   `SELECT` (authenticated): `USING (id = auth.uid())`.
*   `UPDATE` (authenticated): `USING (id = auth.uid())` `WITH CHECK (id = auth.uid())`.
*   `INSERT/DELETE`: Blocked.

#### `room_chats`
*   `SELECT` (authenticated): `USING (is_room_member(room_id))`.
*   `INSERT/UPDATE/DELETE`: Blocked.

---

### `is_room_member(room_id)` Bypass Helper
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

**What this does:**
This SQL function checks if the user making the query is registered as a participant in a given room. By setting the function's execution permissions to `SECURITY DEFINER`, it executes with the privileges of the database user who created the function (the owner, who is not restricted by Row-Level Security), rather than the user calling it. This allows RLS select policies to verify room membership in `room_participants` without causing infinite recursion.

---

### `on_auth_user_created` Trigger
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', '')
  );
  RETURN NEW;
END;
$$;
```

**What this does:**
This function is designed to execute as a PostgreSQL database trigger. Whenever a user registers a new account and is added to the system table `auth.users`, this function automatically runs. It retrieves the newly created user's ID (`NEW.id`) and their display name (parsed from the raw user metadata field) and inserts a new profile record into the public `profiles` table, synchronizing the user's database presence automatically.

### Why Write Actions Use `SECURITY DEFINER` RPCs
`SECURITY DEFINER` functions run with owner privileges, bypassing RLS write checks. This allows the database to perform updates (such as deducting budget or adding bids) in a controlled transaction, ensuring client-side requests cannot bypass the business logic.

### Private Room Protection
When `is_public` is `false`, a room is excluded from the discovery list returned by `listPublicRooms()`. The room page (`/room/[id]`) checks if the user is a participant. If not, it redirects or prompts the user, preventing access via URL guessing.

### Route Guards
All protected pages (`/rooms`, `/room/[id]`, `/create`, `/join`, `/join/[code]`) use a `useEffect` guard that checks the `user` state from `AuthProvider.tsx`. If unauthenticated, it redirects to `/auth`.

---

## SECTION 9 — ALL RPC FUNCTIONS

### 1. `create_room`
*   **Parameters**: `p_room_name` (`text`), `p_admin_user_id` (`uuid`), `p_purse_budget_lakhs` (`int`), `p_max_squad_size` (`int`), `p_bid_timer_seconds` (`int`), `p_is_public` (`boolean`), `p_player_order` (`text`).
*   **Returns**: `json`
*   **Access**: Any authenticated user.
*   **Logic**: Generates a unique 6-character room code, inserts the room record, and inserts the admin as the first participant. Returns the room details and participant ID.
*   **Error Conditions**: Raises an error if room code generation loops excessively.

### 2. `join_room`
*   **Parameters**: `p_room_code` (`text`), `p_user_id` (`uuid`), `p_display_name` (`text`), `p_squad_name` (`text`).
*   **Returns**: `json`
*   **Access**: Any authenticated user.
*   **Logic**: Finds the room. Checks if status is `'LOBBY'`, if the room is full (max 5 players), and if the user has already joined. If valid, inserts a participant record and returns the participant details.
*   **Error Conditions**: Raises errors for `'Room not found'`, `'Room is not accepting new participants'`, `'Room is full'`, or `'You have already joined this room'`.

### 3. `start_auction`
*   **Parameters**: `p_room_id` (`uuid`), `p_admin_user_id` (`uuid`).
*   **Returns**: `json`
*   **Access**: Admin only.
*   **Logic**: Verifies admin privileges, checks if the room is in `'LOBBY'` status, and ensures there are at least 2 participants. Calls `seed_room_players()`, sets room status to `'AUCTION'`, and activates the first player.
*   **Error Conditions**: Raises errors for `'Room not found'`, `'Only the room admin can start'`, `'Auction can only be started from lobby'`, or `'Need at least 2 participants'`.

### 4. `start_auction_dev`
*   **Parameters**: `p_room_id` (`uuid`), `p_admin_user_id` (`uuid`).
*   **Returns**: `json`
*   **Access**: Admin only.
*   **Logic**: Identical to `start_auction` but skips the 2-participant minimum check for local testing.

### 5. `place_bid`
*   **Parameters**: `p_room_player_id` (`uuid`), `p_participant_id` (`uuid`), `p_amount_lakhs` (`int`).
*   **Returns**: `json`
*   **Access**: Room participants.
*   **Logic**: Locks the room player and participant records. Validates active status, time remaining, bid increments, remaining budget, and squad size. Inserts the bid and extends the timer if needed.
*   **Error Conditions**: Raises errors for player not active, expired timer, insufficient budget, or full squad.

### 6. `check_and_resolve`
*   **Parameters**: `p_room_id` (`uuid`).
*   **Returns**: `json`
*   **Access**: Any room member.
*   **Logic**: Locks the active room player. If expired, gets the highest bid, updates status to `'SOLD'` or `'UNSOLD'`, deducts the budget, and calls `advance_to_next_player()`.
*   **Error Conditions**: Raises `'Room not found'`.

### 7. `resolve_expired_auctions`
*   **Parameters**: None.
*   **Returns**: `void`
*   **Access**: pg_cron / Internal.
*   **Logic**: Loops over all expired active players, resolves them, and advances to the next player.

### 8. `pause_auction`
*   **Parameters**: `p_room_id` (`uuid`), `p_admin_user_id` (`uuid`).
*   **Returns**: `json`
*   **Access**: Admin only.
*   **Logic**: Validates admin. Saves remaining seconds, clears `ends_at`, and sets room status to `'PAUSED'`.
*   **Error Conditions**: Raises error if not admin or room is not active.

### 9. `resume_auction`
*   **Parameters**: `p_room_id` (`uuid`), `p_admin_user_id` (`uuid`).
*   **Returns**: `json`
*   **Access**: Admin only.
*   **Logic**: Restores the timer and sets room status to `'AUCTION'`.
*   **Error Conditions**: Raises error if not admin or room is not paused.

### 10. `force_resolve_current_player`
*   **Parameters**: `p_room_id` (`uuid`), `p_admin_user_id` (`uuid`).
*   **Returns**: `json`
*   **Access**: Admin only.
*   **Logic**: Force-resolves the active player immediately based on current bids, and advances to the next player.
*   **Error Conditions**: Raises error if not admin or no active player.

### 11. `end_auction_early`
*   **Parameters**: `p_room_id` (`uuid`), `p_admin_user_id` (`uuid`).
*   **Returns**: `json`
*   **Access**: Admin only.
*   **Logic**: Marks all pending and active players as `'UNSOLD'` and sets room status to `'COMPLETED'`.
*   **Error Conditions**: Raises error if not admin.

### 12. `send_chat`
*   **Parameters**: `p_room_id` (`uuid`), `p_participant_id` (`uuid`), `p_message` (`text`).
*   **Returns**: `json`
*   **Access**: Room participants.
*   **Logic**: Verifies participation and inserts the message.
*   **Error Conditions**: Raises error if not a participant or message is empty.

### 13. `handle_new_user`
*   **Parameters**: Trigger payload.
*   **Returns**: `trigger`
*   **Access**: Database internal.
*   **Logic**: Inserts a profile record on user signup.

### 14. `is_room_member`
*   **Parameters**: `p_room_id` (`uuid`).
*   **Returns**: `boolean`
*   **Access**: RLS policy evaluator.
*   **Logic**: Returns true if the user is a member of the room.

### 15. `advance_to_next_player`
*   **Parameters**: `p_room_id` (`uuid`).
*   **Returns**: `void`
*   **Access**: Database internal helper.
*   **Logic**: Finds the next pending player and sets them to active, or marks the room as completed.

---

## SECTION 10 — PLAYER ORDERING ALGORITHM

### RANDOM Strategy
```sql
INSERT INTO room_players (room_id, player_id, order_index)
SELECT p_room_id, id, row_number() OVER (ORDER BY random())
FROM players;
```

**What this does:**
This SQL statement populates the `room_players` table for a specific room. It selects all cricketers from the static catalog table `players` and shuffles them randomly using `ORDER BY random()`. It assigns a sequential index (`row_number()`) to each player, starting at 1, which represents their ordering for the auction.

### CATEGORY Strategy
1.  Splits players into two pools by rating:
    *   **Himeds** (High/Medium rating): `rating >= 6`
    *   **Lows** (Low rating): `rating < 6`
2.  Both pools are shuffled independently: `ORDER BY random()`.
3.  Calculates pool lengths `n_h` and `n_l`.
4.  Loops to interleave the pools:
    *   If the low pool is empty, picks from himeds.
    *   If the himeds pool is empty, picks from lows.
    *   Otherwise, draws from himeds with a **75% probability** and from lows with a **25% probability**.
5.  Saves the sequence to `room_players` using `unnest() WITH ORDINALITY`.

### Why This strategy is Better
Pure random ordering can result in long clusters of low-rated players, which reduces engagement. The category strategy interleaves high-rated players with low-rated players, ensuring exciting moments are distributed throughout the auction. Reshuffling the pools ensures the order is unique for each room.

---

## SECTION 11 — FRONTEND COMPONENTS

### `AuctionView.tsx`
*   **File Path**: `Frontend/src/components/auction/AuctionView.tsx`
*   **Renders**: The three-column live auction layout, including the squad panel, player card, countdown, bids, balance, and chat.
*   **Props**: `snapshot` (`RoomSnapshot`), `participant` (`RoomParticipant`), `isAdmin` (`boolean`), `userId` (`string`), `myPlayers` (`RoomPlayer & { player: Player }[]`).
*   **Local State**: `inlineResult` (`InlineResult | null`).
*   **Hooks**: `useRef`, `useEffect` (for auto-resolving rounds and showing results overlays).
*   **Notable Detail**: Uses a 3-second auto-dismissing inline overlay to show sold results inside the timer ring.

### `AdminToolbar.tsx`
*   **File Path**: `Frontend/src/components/auction/AdminToolbar.tsx`
*   **Renders**: Admin action controls (Pause, Resume, Skip, End).
*   **Props**: `roomId` (`string`), `adminUserId` (`string`), `roomStatus` (`RoomStatus`).
*   **Local State**: `loading` (`boolean`).
*   **Hooks**: `useAuth` (to verify admin identity).

### `PlayerCard.tsx`
*   **File Path**: `Frontend/src/components/auction/PlayerCard.tsx`
*   **Renders**: Active player information, rating, base price, and image.
*   **Props**: `player` (`Player`), `basePrice` (`number`).
*   **Local State**: None.
*   **Hooks**: None.

### `CountdownTimer.tsx`
*   **File Path**: `Frontend/src/components/auction/CountdownTimer.tsx`
*   **Renders**: SVG countdown progress ring.
*   **Props**: `endsAt` (`string | null`), `isPaused` (`boolean`), `timerSeconds` (`number`), `resultState` (`ResultState`).
*   **Local State**: None.
*   **Hooks**: `useTimer` (to update the SVG stroke offset).
*   **Notable Detail**: Animates the stroke offset dynamically: `CIRC * (1 - progress)`.

### `BidButtons.tsx`
*   **File Path**: `Frontend/src/components/auction/BidButtons.tsx`
*   **Renders**: Bidding increment buttons.
*   **Props**: `currentBidLakhs` (`number`), `basePriceLakhs` (`number`), `participantId` (`string`), `roomPlayerId` (`string`), `remainingBudget` (`number`), `maxSquadSize` (`number`), `currentSquadCount` (`number`), `isPaused` (`boolean`), `isExpired` (`boolean`).
*   **Local State**: `bidding` (`number | null`), `error` (`string | null`).
*   **Hooks**: `useState` (to track active button submissions).

### `BidHistory.tsx`
*   **File Path**: `Frontend/src/components/auction/BidHistory.tsx`
*   **Renders**: Visual history of the 5 most recent bids.
*   **Props**: `bids` (`Bid[]`), `participants` (`RoomParticipant[]`).
*   **Local State**: None.
*   **Hooks**: None.
*   **Notable Detail**: Centers the highest bid and fades older bids outward.

### `BalancePanel.tsx`
*   **File Path**: `Frontend/src/components/auction/BalancePanel.tsx`
*   **Renders**: Remaining budget and squad slots.
*   **Props**: `remainingBudget` (`number`), `totalBudget` (`number`), `squadCount` (`number`), `maxSquadSize` (`number`), `nextPlayer` (`Player | null`).
*   **Local State**: None.
*   **Hooks**: None.
*   **Notable Detail**: Hovering triggers a 3D Y-axis rotation to preview the next player.

### `MySquad.tsx`
*   **File Path**: `Frontend/src/components/auction/MySquad.tsx`
*   **Renders**: Roster grid of players won by the participant.
*   **Props**: `players` (`RoomPlayer & { player: Player }[]`), `maxSquadSize` (`number`).
*   **Local State**: None.
*   **Hooks**: None.

### `TeamsPanel.tsx`
*   **File Path**: `Frontend/src/components/auction/TeamsPanel.tsx`
*   **Renders**: Accordion list of other teams' budgets and rosters.
*   **Props**: `participants` (`RoomParticipant[]`), `soldPlayers` (`RoomPlayer & { player: Player }[]`), `currentUserId` (`string`).
*   **Local State**: `expandedId` (`string | null`).
*   **Hooks**: `useState`.

### `ChatPanel.tsx`
*   **File Path**: `Frontend/src/components/auction/ChatPanel.tsx`
*   **Renders**: Real-time room chat messages.
*   **Props**: `roomId` (`string`), `participantId` (`string`), `participants` (`RoomParticipant[]`).
*   **Local State**: `messages` (`ChatMessage[]`), `input` (`string`), `sending` (`boolean`).
*   **Hooks**: `useState`, `useEffect`, `useRef`.

### `PlayerImage.tsx`
*   **File Path**: `Frontend/src/components/auction/PlayerImage.tsx`
*   **Renders**: Player headshot image.
*   **Props**: `player` (`Player`), `className` (`string`).
*   **Local State**: `error` (`boolean`).
*   **Hooks**: `useState`.

### `LobbyView.tsx`
*   **File Path**: `Frontend/src/components/lobby/LobbyView.tsx`
*   **Renders**: Room parameters, joined members, and start controls.
*   **Props**: `snapshot` (`RoomSnapshot`), `participant` (`RoomParticipant`), `isAdmin` (`boolean`).
*   **Local State**: `starting` (`boolean`), `error` (`string | null`).
*   **Hooks**: `useState`.

### `ResultsView.tsx`
*   **File Path**: `Frontend/src/components/results/ResultsView.tsx`
*   **Renders**: Leaderboard, squad details, spend summaries, and share controls.
*   **Props**: `roomId` (`string`), `participants` (`RoomParticipant[]`).
*   **Local State**: `players` (`RoomPlayer & { player: Player }[]`), `loading` (`boolean`), `copied` (`boolean`).
*   **Hooks**: `useState`, `useEffect`.

---

## SECTION 12 — CUSTOM HOOKS

### `useRoom`
*   **Returns**: `{ snapshot, loading, error, refetch }`
*   **Internal State**: `snapshot` (`RoomSnapshot | null`), `loading` (`boolean`), `error` (`string | null`).
*   **Side Effects**:
    *   `useEffect` (dependency `fetchSnapshot`): Fetches the room snapshot on mount.
    *   `useEffect` (dependencies `roomId`, `fetchSnapshot`): Subscribes to the room's real-time channel.
*   **Realtime Channels**: `room:${roomId}` channel listening for table updates.
*   **Edge Cases**: Refetches the full snapshot on any change event to prevent budget desynchronization.

### `useParticipant`
*   **Returns**: `{ participant, isAdmin, myPlayers }`
*   **Internal State**: None. Uses React `useMemo`.
*   **Side Effects**: None.
*   **Realtime Channels**: None.

### `useLocalUser`
*   **Returns**: `{ userId, participantId, roomId, setParticipant, loading }`
*   **Internal State**: `participantData` (`{ participantId, roomId }`).
*   **Side Effects**: None.
*   **Edge Cases**: Returns a loading indicator while `useAuth` is loading.

### `useTimer`
*   **Returns**: `{ secondsRemaining, progress, isExpired, isUrgent }`
*   **Internal State**: `secondsRemaining` (`number`), `progress` (`number`).
*   **Side Effects**:
    *   `useEffect` (dependencies `endsAt`, `isPaused`, `tick`, `totalSeconds`): Initializes and cleans up the RAF tick.
*   **Edge Cases**: Caps progress at `1.0` if a bid extension increases the duration beyond the base value.

---

## SECTION 13 — AUTHENTICATION FLOW

### Registration & Sign In
Authentication is handled via the form at `/auth`.
*   **Sign Up**: Calls `supabase.auth.signUp({ email, password })`.
*   **Sign In**: Calls `supabase.auth.signInWithPassword({ email, password })`.

### Signup Database Trigger
The database trigger `on_auth_user_created` calls `handle_new_user()`, which automatically creates a corresponding profile record in the public `profiles` table.

### Session Cookies (`Frontend/src/middleware.ts` / `Backend/middleware.ts`)
The server middleware intercepts requests:
```typescript
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      }
    }
  }
);
await supabase.auth.getUser();
```

**What this does:**
This code runs inside Next.js server-side middleware for matching routes. It creates an instance of the Supabase server client using `@supabase/ssr` `createServerClient`. The helper functions retrieve active cookies from the request headers and apply modified cookies back to the response headers. Calling `await supabase.auth.getUser()` triggers session validation; if the JWT token is expired but a valid refresh token exists, Supabase handles token refresh and updates cookies in response headers.

---

### Context Distribution (`AuthProvider.tsx`)
`AuthProvider.tsx` wraps the app and listens for auth changes:
```typescript
const {
  data: { subscription },
} = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, s: Session | null) => {
  setSession(s);
  setUser(s?.user ?? null);
  setLoading(false);
});
```

**What this does:**
This sets up an event listener using the client-side Supabase SDK's `onAuthStateChange` handler. Whenever a user logs in, signs up, logs out, or the authentication token is automatically refreshed, this callback is fired, updating the local React state variables (`session` and `user`). It returns a subscription object, which is cleaned up (unsubscribed) when the provider component unmounts.

### `useLocalUser` Auth Mapping
`useLocalUser` calls `useAuth()` to retrieve the `user.id` and maps it to `userId`.

### Page Guards
The page guards check `user` and `authLoading` states. If unauthenticated and loading completes, the user is redirected to `/auth`.

### Developer Mode
When `NEXT_PUBLIC_DEV_MODE=true` is enabled, a dev login panel is displayed on `/auth` containing quick-login buttons for:
*   `test@test.com` (password: `123789`)
*   `test@test1.com` (password: `123789`)
*   `test@test2.com` (password: `123789`)
*   `test@test3.com` (password: `123789`)
Clicking a button attempts to log in, and automatically registers the account if it does not exist.

---

## SECTION 14 — API LAYER

### Client API Wrappers (`Frontend/src/lib/api.ts`)
*   `createRoom`: Invokes the `create_room` RPC.
*   `joinRoom`: Invokes the `join_room` RPC.
*   `startAuction`: Invokes `start_auction` or `start_auction_dev` RPC.
*   `placeBid`: Invokes the `place_bid` RPC.
*   `pauseAuction`: Invokes the `pause_auction` RPC.
*   `resumeAuction`: Invokes the `resume_auction` RPC.
*   `forceResolveCurrentPlayer`: Invokes the `force_resolve_current_player` RPC.
*   `endAuctionEarly`: Invokes the `end_auction_early` RPC.
*   `checkAndResolve`: Invokes the `check_and_resolve` RPC.
*   `getRoomSnapshot`: Selects data from `rooms`, `room_participants`, and `room_players` tables.
*   `listPublicRooms`: Selects open lobby rooms.
*   `listMyRooms`: Queries user room associations.
*   `getRoomResults`: Selects resolved player details.
*   `sendChat`: Invokes the `send_chat` RPC.
*   `getRoomChats`: Selects chat messages.

### Next.js API Routes
*   `POST /api/rooms`: Creates a room server-side by calling the `create_room` RPC.
*   `GET /api/rooms/[id]`: Resolves a full room snapshot from the database.

---

## SECTION 15 — BID INCREMENT CALCULATOR

### Calculation Algorithm
1.  **Effective Bid**: `effectiveBid = Math.max(currentHighestBid, basePrice)`.
2.  **Tier Percentages**:
    *   Budget (≤ ₹100L): `10%, 20%, 35%, 50%`
    *   Mid (≤ ₹500L): `5%, 10%, 18%, 25%`
    *   Premium (≤ ₹1500L): `3%, 7%, 11%, 15%`
    *   Marquee (> ₹1500L): `2%, 4%, 7%, 10%`
3.  **Rounding Rules**:
    *   `< 100` L: Round to nearest multiple of 5.
    *   `< 500` L: Round to nearest multiple of 10.
    *   `< 1000` L: Round to nearest multiple of 25.
    *   `≥ 1000` L: Round to nearest multiple of 50.
4.  **Deduplication**: Filters duplicate increment values.
5.  **Option Filling**: If fewer than 4 options exist, generates additional candidates (e.g. halfway values or extensions like `maxInc * 1.5`).
6.  **Budget Filtering**: Discards options where `effectiveBid + increment > remainingBudget`.
7.  **Minimum Bid Inclusion**: Ensures the minimum bid (`effectiveBid + 5`) is available if the user's budget allows it.

---

## SECTION 16 — DESIGN SYSTEM

### Custom CSS Properties
*   `--color-void` (`#0A0A0F`): Deep background canvas.
*   `--color-surface` (`#141419`): Standard container surface.
*   `--color-surface-raised` (`#1C1C24`): Elevated card container surface.
*   `--color-amber` (`#D4A843`): Interactive borders and active bid status.
*   `--color-amber-glow` (`#F5C542`): Highlighting for winning bid states.
*   `--color-chalk` (`#E8E4DC`): Default text.
*   `--color-muted` (`#6B6B7B`): Secondary text.
*   `--color-danger` (`#E5484D`): Destructive alerts and low-time timer warnings.
*   `--color-success` (`#30A46C`): Confirmed status.
*   `--color-hairline` (`#1F1F29`): Inset board borders.
*   `--color-hairline-strong` (`#38384A`): Elevated borders.

### Elevation Surface Ladder
*   **Base Page**: Tinted at `--color-void`.
*   **Card Container**: Styled with `--color-surface`.
*   **Active Control**: Styled with `--color-surface-raised`.

### Typography
*   **Font Families**: Sans-serif (`Geist` / `Inter`) and Monospace (`Geist Mono` / `JetBrains Mono`).
*   **Tabular Numbers**: CountdownTimer and BalancePanel use `font-variant-numeric: tabular-nums` to prevent text shifts as numbers change.

### Warm Accent Rule
Colours like amber and amber-glow are used sparingly, reserved only for active bids, high bidding tiers, and active countdown timer status.

### Custom Animations
*   `chip-pop`: Scale transform from 0.8 to 1.05.
*   `bid-flash`: Flashes background to signal new bids.

---

## SECTION 17 — GAMEPLAY FLOW (END-TO-END)

### A. Room Creation
The host selects room settings:
*   `purse_budget_lakhs`: ₹100, ₹150, ₹200, ₹250 Cr.
*   `max_squad_size`: 10, 15, 20, 25.
*   `bid_timer_seconds`: 10, 15, 20, 25, 30.
*   `player_order`: `'RANDOM'` or `'CATEGORY'`.
*   `is_public`: Visibility toggle.
Creating the room inserts a record in `rooms` and registers the host in `room_participants`.

### B. Joining the Room
Participants join via code or invite link. Joining validates room status and inserts a record in `room_participants`.

### C. The Lobby
`LobbyView` displays joined participants. Real-time updates sync new members instantly.

### D. Starting the Auction
The admin clicks "Start". The database function shuffles and sequences players, sets room status to `'AUCTION'`, and sets the first player to `'ACTIVE'` with an `ends_at` timestamp.

### E. Bidding Rounds
The player card and countdown are displayed. Placing a bid locks records, verifies the bid is valid, inserts the bid, and extends the timer if less than 10 seconds remain.

### F. Pausing and Resuming
The admin can pause the auction, which stores the remaining time and clears the `ends_at` timestamp. Resuming recalculates `ends_at` using the remaining duration.

### G. Admin Skip / End Early
*   **Skip**: Force-resolves the active player and advances to the next player.
*   **End Early**: Sets remaining players to `'UNSOLD'` and room status to `'COMPLETED'`.

### H. Post-Auction Results
`ResultsView` displays squad details, total spent, and rosters. Results can be copied to the clipboard for sharing.

---

## SECTION 18 — LOCAL SETUP

### Setup Commands
```bash
# 1. Clone repository
git clone <url> 11auction
cd 11auction

# 2. Install dependencies
npm install

# 3. Create env file
cp .env.example .env.local
```

**What this does:**
These shell commands download the project files from a Git repository, navigate into the project root directory, run `npm install` to download dependencies listed in `package.json`, and duplicate the `.env.example` file template into `.env.local` to allow setting environment variables for local testing.

### Env Configuration (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
NEXT_PUBLIC_DEV_MODE=true
```

**What this does:**
This outlines the required configuration settings for the local environment variables. `NEXT_PUBLIC_SUPABASE_URL` maps the endpoint of your Supabase project, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` defines the public access token, and setting `NEXT_PUBLIC_DEV_MODE=true` enables developer tools such as dev login options and starting auctions with single participants.

### Database Migration Order
Paste and run these in the Supabase **SQL Editor**:
1.  `Database/supabase/combined_migration.sql`
2.  `Database/supabase/005_chat.sql`
3.  `Database/supabase/migrations/008_auth_profiles.sql`
4.  `Database/supabase/migrations/009_fix_rls.sql`
5.  `Database/supabase/dev_functions.sql`

### Supabase Settings
In your Supabase project under **Authentication -> Settings**, disable **Confirm Email** so users can sign up and log in instantly on localhost.

### Running the App
The project is structured with a root-level `package.json` proxy, meaning you can execute commands directly at the root of the workspace:
*   **Development**: `npm run dev` (runs Next.js inside `Frontend` on port 3000).
*   **Testing**: `npm run dev:test` (runs Next.js inside `Frontend` on port 3003 with bypass checks active).

### Re-seeding Player Data
To regenerate `Database/supabase/seed.sql` and seed the database, run:
```bash
node Database/data-extraction/generate_seed.mjs
```

**What this does:**
This command executes the script `generate_seed.mjs` using Node.js. The script reads the raw player catalog dataset from `Database/data-extraction/ipl_2026_auction_dataset.json`, converts base price values (e.g. ₹21 Cr) into numeric lakhs, groups them, and writes a structured insert script to `Database/supabase/seed.sql` to seed the database catalog table.

---

## SECTION 19 — MIGRATION ORDER AND FILE ROLES

1.  `combined_migration.sql` (Safe to run once): Seeds database tables, indexes, core RPCs, and catalog players.
2.  `001_schema.sql` (Legacy): Core schema tables definition.
3.  `002_rls_policies.sql` (Legacy): Basic RLS policies.
4.  `003_functions.sql` (Legacy): Core bidding and timer resolution RPCs.
5.  `004_cron.sql` (Safe to run): Schedules the pg_cron safety-net resolver.
6.  `005_chat.sql` (Safe to run): Chat schema and `send_chat` RPC (physically located in the `Database/supabase/` root directory).
7.  `006_realtime_fix.sql` (Idempotent): Configures `REPLICA IDENTITY FULL` on tables.
8.  `007_room_options.sql` (Idempotent): Adds room options and ordering strategies.
9.  `008_auth_profiles.sql` (Idempotent): Creates profiles table and signup trigger.
10. `009_fix_rls.sql` (Idempotent): Resolves infinite recursion issues in RLS policies.

---

## SECTION 20 — PROJECT FILE MAP

### Database Directory (`Database/`)
*   `Database/supabase/migrations/001_schema.sql` — Schema definition for rooms, participants, players, and bids.
*   `Database/supabase/migrations/002_rls_policies.sql` — Basic database access controls.
*   `Database/supabase/migrations/003_functions.sql` — Core transactional database procedures.
*   `Database/supabase/migrations/004_cron.sql` — Scheduled pg_cron safety-net sweep configuration.
*   `Database/supabase/005_chat.sql` — Chat schema and send function.
*   `Database/supabase/migrations/006_realtime_fix.sql` — Enables replica identity full for real-time updates.
*   `Database/supabase/migrations/007_room_options.sql` — Strategy algorithms and room parameter columns.
*   `Database/supabase/migrations/008_auth_profiles.sql` — Profiles synchronization trigger.
*   `Database/supabase/migrations/009_fix_rls.sql` — Recursion-free RLS policies.
*   `Database/supabase/combined_migration.sql` — Consolidated database setup file.
*   `Database/supabase/dev_functions.sql` — Dev bypass procedure script.
*   `Database/supabase/seed.sql` — 90-player IPL database seed inserts.
*   `Database/supabase/MIGRATIONS.md` — Migration dependency reference documentation.
*   `Database/data-extraction/ipl_2026_auction_dataset.json` — Raw JSON dataset containing cricketer statistics.
*   `Database/data-extraction/generate_seed.mjs` — Script converting raw cricketer records to SQL seed.

### Backend Directory (`Backend/`)
*   `Backend/api/rooms/route.ts` — The actual business logic handler for POST `/api/rooms`.
*   `Backend/api/rooms/[id]/route.ts` — The actual snapshot generator logic for GET `/api/rooms/[id]`.
*   `Backend/middleware.ts` — Server-side authentication and session token refresh handler logic.

### Frontend Directory (`Frontend/`)
*   `Frontend/package.json` — Next.js project package configuration mapping script routines and workspace dependencies.
*   `Frontend/next.config.ts` — Application compiler configuration enabling custom Turbopack root workspace resolver.
*   `Frontend/tsconfig.json` — TypeScript mappings defining path aliases to Frontend (`@/*`) and Backend (`@backend/*`).
*   `Frontend/src/middleware.ts` — Middleware wrapper exporting matcher config and calling the Backend middleware.
*   `Frontend/src/app/api/rooms/route.ts` — API route wrapper importing and exporting POST from Backend.
*   `Frontend/src/app/api/rooms/[id]/route.ts` — API route wrapper importing and exporting GET from Backend.
*   `Frontend/src/app/globals.css` — Custom styling and color themes.
*   `Frontend/src/app/layout.tsx` — Root document layout wrapping the AuthProvider.
*   `Frontend/src/app/page.tsx` — Landing page with the profile bar.
*   `Frontend/src/app/auth/page.tsx` — Sign In / Sign Up view with local dev login options.
*   `Frontend/src/app/rooms/page.tsx` — Rooms discovery hub.
*   `Frontend/src/app/create/page.tsx` — Room configuration options page.
*   `Frontend/src/app/join/page.tsx` — Code validation join page.
*   `Frontend/src/app/join/[code]/page.tsx` — Auto-filled join page.
*   `Frontend/src/app/room/[id]/page.tsx` — Main room route wrapper.
*   `Frontend/src/components/AuthProvider.tsx` — Global React context provider for authentication.
*   `Frontend/src/components/auction/AuctionView.tsx` — Main interactive live auction dashboard.
*   `Frontend/src/components/auction/AdminToolbar.tsx` — Controls for room admins.
*   `Frontend/src/components/auction/PlayerCard.tsx` — Cricketer card.
*   `Frontend/src/components/auction/CountdownTimer.tsx` — Visual countdown timer ring.
*   `Frontend/src/components/auction/BidButtons.tsx` — Bidding increment controls.
*   `Frontend/src/components/auction/BidHistory.tsx` — Ordered center-anchored bid display.
*   `Frontend/src/components/auction/BalancePanel.tsx` — Remaining budget display with 3D card flip.
*   `Frontend/src/components/auction/MySquad.tsx` — Roster slots panel.
*   `Frontend/src/components/auction/TeamsPanel.tsx` — Other squads accordion panel.
*   `Frontend/src/components/auction/ChatPanel.tsx` — Real-time room chat component.
*   `Frontend/src/components/auction/PlayerImage.tsx` — Player image component with initials fallback.
*   `Frontend/src/components/lobby/LobbyView.tsx` — Pre-auction waiting lobby.
*   `Frontend/src/components/results/ResultsView.tsx` — Post-auction results dashboard.
*   `Frontend/src/hooks/useRoom.ts` — Room state sync hook.
*   `Frontend/src/hooks/useParticipant.ts` — Hook to resolve the active user's participant context.
*   `Frontend/src/hooks/useLocalUser.ts` — Identity and local storage coordinator hook.
*   `Frontend/src/hooks/useTimer.ts` — requestAnimationFrame visual timer loop.
*   `Frontend/src/lib/types.ts` — Unified TypeScript models.
*   `Frontend/src/lib/api.ts` — Database service layer.
*   `Frontend/src/lib/bidCalculator.ts` — Smart increment generator math.
*   `Frontend/src/lib/utils.ts` — Currency formatting utilities.
*   `Frontend/src/lib/supabase/client.ts` — Supabase browser client wrapper.
*   `Frontend/src/lib/supabase/server.ts` — Supabase server client cookie wrapper.
*   `Frontend/src/lib/supabase/realtime.ts` — Real-time event filters.

---

## SECTION 21 — KNOWN LIMITATIONS AND PRODUCTION FIXES

### 1. pg_cron Safety-Net Latency
*   **Limitation**: `pg_cron` can only run at most every 60 seconds. If all players leave, the active auction can hang for up to a minute before the player is marked UNSOLD.
*   **Production Fix**: Introduce a task scheduler (like pg-boss or a Redis-backed queue) inside a Next.js API route or edge function to schedule an exact, single-shot execution of `check_and_resolve` when the timer expires.

### 2. Client-Server Time Drift
*   **Limitation**: JavaScript clock skew can cause the client-side timer to end before or after the database `ends_at` time.
*   **Production Fix**: Sync the client clock with the database server time on mount by calculating a delta offset, adjusting the end time using `endsAt - serverOffset`.

### 3. Bid Spamming
*   **Limitation**: Bids are not rate-limited at the database level, allowing a client to spam the `place_bid` RPC and generate heavy write traffic.
*   **Production Fix**: Implement rate limiting using Redis token buckets inside Next.js API routes before calling the database function.

---

## SECTION 22 — QUICK STATS

*   **Total Cricketers**: 90 players (RCB: 22, GT: 22, SRH: 23, RR: 23).
*   **Purse Budgets**: ₹100 Cr, ₹150 Cr, ₹200 Cr, ₹250 Cr.
*   **Squad Sizes**: 10, 15, 20, 25.
*   **Timer Lengths**: 10, 15, 20, 25, 30 seconds.
*   **RPC Functions**: 15 database functions.
*   **Migration Files**: 10 migration files (8 under `migrations/`).
*   **Real-Time Subscriptions**: 5 table-level filters (rooms, participants, players, bids, chats).
*   **pg_cron Frequency**: Every 60 seconds (`* * * * *`).
*   **Anti-Sniping Extension Threshold**: 10 seconds.
*   **Min Participants to Start**: 2 players (bypassed in Dev Mode).
*   **Room Code Length**: 6 characters (uppercase, alphanumeric).
*   **Database Engine**: PostgreSQL 15+.
*   **Primary Accent Color**: Amber (`#D4A843`).

---

## SECTION 23 — INTERVIEW Q&A

**Q: Tell me how your application updates in real-time.**
**A:** I built the real-time synchronization engine using Supabase Realtime Channel subscriptions listening to PostgreSQL WAL updates (`postgres_changes`). The client subscribes to changes in `rooms`, `room_participants`, `room_players`, and `bids` filtered by `room_id`. Whenever a transaction commits, the WAL writes are broadcast via WebSockets. The React hook `useRoom` intercepts these events, patches the local room state, and fetches the full snapshot from `/api/rooms/[id]` to reconcile participant budgets and squad states.

**Q: Why did you configure your tables with `REPLICA IDENTITY FULL`?**
**A:** When Row-Level Security (RLS) is enabled, the Supabase Realtime router needs to evaluate RLS policies against the modified row data before broadcasting it. Under PostgreSQL's default replica identity, only the primary key is written to the WAL during updates. This meant updates to `room_participants` (like budget changes) were blocked by the router and not delivered to non-admin clients. Enabling `REPLICA IDENTITY FULL` logs the entire row image in the WAL, allowing the real-time engine to authorize and broadcast budget changes to all connected clients.

**Q: How do you prevent double-spending when two users bid simultaneously?**
**A:** Double-spending is prevented in the `place_bid()` database function by locking rows sequentially inside a single transaction using `FOR UPDATE`. First, we lock the active row in `room_players`, and then we lock the bidder's row in `room_participants`. This serializes budget evaluations. If two bids are processed at the same time, the second transaction waits until the first commits, ensuring it evaluates the budget against the updated, correct value.

**Q: How does your serverless timer work without a persistent node daemon?**
**A:** I implemented a dual-layer resolution strategy. The frontend runs a precise local countdown timer using `requestAnimationFrame`. When it reaches 0, the client calls the `check_and_resolve()` RPC, which validates that `ends_at <= now()` and resolves the round database-authoritative. If all clients disconnect, a database safety net scheduled via `pg_cron` runs every minute, calling `resolve_expired_auctions()` to clean up any unresolved active rounds.

**Q: What happens if a user submits a bid at the exact millisecond the timer runs out?**
**A:** The database transaction handles this via sequential locks. If the bid transaction locks the `room_players` row first, it validates the time `ends_at > now()`, inserts the bid, and extends the timer. If the `check_and_resolve` transaction locks the row first, it marks the player as sold or unsold. When the bid transaction resumes, it sees the player's status is no longer `'ACTIVE'` and fails validation, preventing the bid from being placed.

**Q: What is RLS recursion, and how did you resolve it in this project?**
**A:** RLS recursion occurs when a policy on a table queries the same table to validate access, creating an infinite loop. In our case, checking if a user belongs to a room on `room_participants` required querying `room_participants` itself. I resolved this by extracting the check into a `SECURITY DEFINER` function `is_room_member(room_id)`. Because it runs with owner privileges, it bypasses RLS rules, allowing it to perform the lookup safely without triggering the policy loop.

**Q: How do your protected routes detect unauthenticated users and redirect them?**
**A:** We use Next.js server-side middleware (`Frontend/src/middleware.ts`) to refresh the user session cookie on every request by calling `supabase.auth.getUser()`. On the client side, our global `AuthProvider` listens for auth state changes. Protected routes use the `useLocalUser` hook to check the session state; if unauthenticated, they redirect the user to `/auth`.

**Q: Explain the category player ordering strategy.**
**A:** The `CATEGORY` strategy splits players into two pools by rating: top/medium (`rating >= 6`) and low (`rating < 6`). Both pools are shuffled randomly, then interleaved using a 75% probability for the top/medium pool and 25% for the low pool. This ensures star players are distributed throughout the auction rather than clustered, and because the pools are reshuffled per game, the order is always unique.

**Q: How does the anti-sniping extension work?**
**A:** In `place_bid()`, when a bid is successfully placed, we check the remaining time. If less than 10 seconds remain, we update the room player's `ends_at` time: `ends_at = GREATEST(ends_at, now() + interval '10 seconds')`. This extends the bidding window, giving other participants a fair chance to react.

**Q: What is the purpose of the Next.js API route `/api/rooms/[id]`?**
**A:** The endpoint acts as an SSR-friendly snapshot resolver. It fetches room parameters, active participants, player order lists, and active bids. Reconciling with this endpoint on real-time events ensures the client stays synchronized even if intermediate WebSocket events are missed.

**Q: How does the client-side visual timer ensure performance?**
**A:** The `useTimer` hook uses `requestAnimationFrame` instead of `setInterval` or `setTimeout`. RAF aligns updates with the browser's repaint cycle, ensuring smooth rendering of the progress ring. It calculates the remaining time dynamically using `Date.now()`, avoiding drift caused by CPU scheduling delays.

**Q: How does the bid button component determine what buttons to show?**
**A:** The `BidButtons` component calls `computeBidOptions()` inside `Frontend/src/lib/bidCalculator.ts`. It maps the player's base price to four increment tiers, rounds them to auction-friendly values, and filters out options that exceed the user's remaining budget.

**Q: Why did you choose Supabase Email/Password authentication?**
**A:** I chose email/password authentication because it is simple and self-contained, allowing developers to test features locally. Users register and log in on `/auth`, and we disable email verification on localhost to grant instant access.

**Q: What role does the `profiles` table play?**
**A:** The `profiles` table stores public user metadata like display names, keeping it separate from private auth data. We use a database trigger `on_auth_user_created` to automatically create a profile record when a new user signs up.

**Q: How did you implement the Vercel-style dark design system?**
**A:** The styling is defined using Tailwind CSS v4 in `globals.css`. I defined a dark color palette using tokens like `--color-void` and `--color-surface`. Typography uses Geist/Inter for sans-serif and Geist Mono/JetBrains Mono for monospace labels, and interactive elements feature subtle mesh gradients and thin borders.

**Q: What is the difference between `start_auction` and `start_auction_dev`?**
**A:** `start_auction` requires at least 2 participants to start a game, which is the default for production. `start_auction_dev` bypasses this check, allowing developers to start the auction alone for testing.

**Q: How do you handle other participants' rosters in the UI?**
**A:** The `TeamsPanel` component lists other participants in an accordion. Clicking a participant expands the list to display their budget and won players.

**Q: Explain how the 3D balance card flip works.**
**A:** In `BalancePanel.tsx`, the card container has `perspective: 1200px` and the inner card has `preserve-3d`. Hovering triggers a `rotateY(180deg)` transition, revealing the next player's image and name on the back.

**Q: How does the chat panel handle real-time messages?**
**A:** The `ChatPanel` component fetches initial messages from `getRoomChats` on mount. It then subscribes to the `room_chats` table via a Supabase channel, appending new messages to the list and scrolling to the bottom automatically.

**Q: What is the purpose of the `useLocalUser` hook?**
**A:** The hook retrieves the authenticated user's ID from `AuthProvider`. It also stores the participant's ID and current room ID in `localStorage` (`auction_user`), ensuring their session remains active if they refresh the page.

**Q: How are players cataloged and seeded?**
**A:** The catalog is stored in the `players` table. We use a script `generate_seed.mjs` to read from the raw JSON file, convert base prices to lakhs, and generate `seed.sql` for seeding.

**Q: How does the admin end an auction early?**
**A:** The admin clicks "End Early", which invokes the `end_auction_early` RPC. This marks all pending and active players as `'UNSOLD'`, clears their timers, and sets the room status to `'COMPLETED'`.

**Q: How do you share results at the end of the game?**
**A:** On the results page, clicking "Share Results" formats the leaderboard, spent budgets, and rosters into a text summary and copies it to the clipboard.

**Q: How do you handle database connection cleanup in React?**
**A:** We return a cleanup function in our `useEffect` hooks. For example, the `useRoom` hook calls `unsubscribeFromRoom()` to unsubscribe from the real-time channel when the component unmounts.

**Q: What security policies prevent users from modifying other participants' bids?**
**A:** Write access to the `bids` table is blocked by RLS policies. Bids can only be submitted via the `place_bid()` RPC, which validates the participant's identity against the active session (`auth.uid()`) before writing to the database.

---

## REVIEW LOG

*   **Physical restructuring implemented**: Moved Next.js application files to `Frontend/`, API route/middleware implementations to `Backend/`, and database migration/seed data to `Database/`.
*   **Added API/Middleware wrappers**: Created wrapper files in `Frontend/src/` to delegate POST/GET requests and middleware executions to `Backend/` implementations while satisfying Next.js route structures.
*   **Configured path alias mappings**: Added `@backend/*` maps in `Frontend/tsconfig.json` to resolve files from the `Backend/` directory cleanly.
*   **Added workspace root for Turbopack**: Updated `Frontend/next.config.ts` setting `turbopack.root` to the parent workspace directory to allow compilation of backend modules outside the project folder.
*   **Created root command proxy**: Added a root `package.json` proxy configuration to forward standard `npm run` commands inside the `Frontend/` folder.
*   **real-time Subscriptions count updated**: In Section 22 and Section 5, `room_chats` (subscribed inside `ChatPanel.tsx`) was added to complete the full subscription count from 4 to 5.
*   **Added Explanation under CLI command**: Added a detailed "What this does" explanation box immediately below the `gemini` CLI practice command in Section 24.
*   **Added Explanation under ASCII art**: Added a detailed "What this does" explanation immediately below the ASCII Entity-Relationship diagram in Section 4.
*   **Added Explanation under anti-sniping update**: Added a detailed "What this does" explanation box immediately below the timer-extension SQL snippet in Section 6.
*   **Added Explanation under place_bid locking statement 1**: Added a detailed "What this does" explanation box immediately below the player row-lock SQL snippet in Section 7.
*   **Added Explanation under place_bid locking statement 2**: Added a detailed "What this does" explanation box immediately below the participant row-lock SQL snippet in Section 7.
*   **Added Explanation under is_room_member helper**: Added a detailed "What this does" explanation box immediately below the membership bypass SQL function in Section 8.
*   **Added Explanation under handle_new_user trigger**: Added a detailed "What this does" explanation box immediately below the profiles trigger function SQL in Section 8.
*   **Added Explanation under RANDOM sorting**: Added a detailed "What this does" explanation box immediately below the random order selection insert SQL in Section 10.
*   **Added Explanation under middleware cookie block**: Added a detailed "What this does" explanation box immediately below the Next.js middleware token refresh TS code in Section 13.
*   **Added Explanation under AuthProvider state listener**: Added a detailed "What this does" explanation box immediately below the client-side session listener React code in Section 13.
*   **Added Explanation under setup commands block**: Added a detailed "What this does" explanation box immediately below the project cloning and setup bash script in Section 18.
*   **Added Explanation under env configurations**: Added a detailed "What this does" explanation box immediately below the local developer environment variable config list in Section 18.
*   **Added Explanation under seed generation script**: Added a detailed "What this does" explanation box immediately below the seeding run command in Section 18.
*   **Corrected Chat schema physical location**: Clarified in Section 19 and the top-level files summary that `005_chat.sql` resides directly in the `Database/supabase/` root directory rather than `supabase/migrations/`.
