# BACKEND + DATABASE PROMPT
### For: Claude Opus 4.6 in terminal / Antigravity — Mini Realtime Auction Room (IPL Edition)

---

## Context

I am building a take-home hiring assignment called **"Mini Realtime Auction Room."** This submission is being evaluated by a real company on: product completeness, **realtime correctness under concurrent use**, engineering quality, frontend quality, deployment, AI usage quality, and my ability to explain my own architecture afterward. Treat this as production-adjacent code, not a throwaway prototype — every shortcut you take, flag explicitly as a tradeoff I need to know about and be able to defend.

I am building an **IPL-themed real-money-free auction game** where friends (3–5 people per room) join a room, each bid for themselves (no teams-of-people — one person = one franchise), and auction off a shared pool of ~100 real IPL players one at a time, live, with a countdown timer, until the pool is exhausted or the admin ends it.

This is conceptually similar to **11auction.com** (a viral cricket-auction site) but is its own independent build — not a clone, not using their code.

## Your Job In This Prompt

Build the **entire backend and database layer** for this project:
1. Supabase Postgres schema (tables, enums, relationships, indexes, RLS policies)
2. Supabase Realtime configuration (channels, broadcast vs. postgres_changes — pick deliberately and justify it)
3. All server-side logic: room creation, joining, the auction state machine, bid validation, timer authority, and resolution
4. Seed script to load the 100-player IPL dataset into the database
5. A clean API/service layer the frontend can call (REST via Supabase client + Realtime subscriptions, OR a thin Next.js API route layer in front of Supabase — your call, but justify it)

**Do not build any UI.** That's a separate workstream. You may stub a `types.ts` / API contract file the frontend will need, but no React/components.

---

## Hard Functional Requirements (from the actual assignment spec — these are non-negotiable)

### Room lifecycle
```
LOBBY -> AUCTION -> COMPLETED
```
- **Create room**: admin sets a room name, **purse budget per participant** (default ₹120 Cr, admin-adjustable), **max squad size per participant** (default 18 players, admin-adjustable), and a per-player bid timer duration (e.g. 30s, admin-adjustable). A short shareable room code is generated.
- **Join room by code/link**: participant enters a display name + squad name (their "franchise" identity for this room — NOT tied to any real IPL team). No login/signup required; lightweight session identity is sufficient (generated user id persisted in a cookie/localStorage, re-used on reconnect).
- **Admin and participant roles**: the room creator is admin. Admin gets the same auction screen as everyone else, plus controls: Start Auction, Pause/Resume, Skip/force-resolve current player, End Auction early.
- **Each room is fully independent**: its own copy of the 100-player pool's auction state (price/sold/unsold/winner), its own participants, its own budgets. The same player can be "sold" for different prices in different rooms simultaneously — there is zero cross-room shared state beyond the static read-only player catalog.
- 3–5 participants expected per room — design for that scale, not thousands.

### Auction flow (the core of the eval)
- One player is "active" at a time, presented in a fixed, admin-controlled or randomized order (your call — state which and why).
- **Server-authoritative countdown timer.** The server computes and stores an `endsAt` timestamp when a player becomes active. Clients only render a countdown derived from that timestamp — they never decide when bidding closes. This is the single most important architectural rule in this entire project. If you ever find yourself writing client-side logic that decides "time's up, this player is sold," stop — that decision belongs only on the server.
- Participants bid while the timer is active. Each new bid must strictly exceed the current highest bid (or the player's base price if no bids yet exist).
- **Highest bid is visible to everyone in the room in realtime.** Bid history for the current player updates live for everyone, not just the bidder.
- **Budget enforcement**: a participant cannot bid an amount that would exceed their remaining purse (`budget - sum of already-won player prices`). Reject server-side with a clear reason.
- **Squad size enforcement**: a participant who has already hit their max squad size cannot bid on further players. Reject server-side with a clear reason.
- When the timer expires: the server resolves the player automatically — **sold** (to the highest bidder, at the highest bid amount, deducted from their budget) or **unsold** (no bids placed). This must happen even if every browser tab is closed — the resolution must NOT depend on any client being connected. (Use a server-side scheduled job / timeout mechanism appropriate for a Supabase-backed deployment — see "Constraints" below for what's actually feasible without a persistent Node server, and propose the right approach.)
- After resolution, auction automatically advances to the next unsold/unauctioned player in the pool, or transitions the room to `COMPLETED` if the pool is exhausted or the admin ends it early.
- **Concurrency correctness is graded explicitly.** If two participants in two different browser tabs bid the same higher amount within the same instant, there must be exactly one deterministic winner decided by the database/server — never a client-side race. Use proper transactional bid validation (e.g. a Postgres function with row locking, or equivalent atomic check-and-insert) so this can't be beaten by a fast client.
- **Pause/Resume**: admin can pause the active player's timer (freezing remaining time, not losing it) and resume later, picking the countdown back up from where it was frozen — not restarting it.
- **Results**: when the room reaches `COMPLETED`, expose a clean queryable summary per participant: their final squad (players + price paid for each), total spent, remaining budget.

### Data model requirements
- Players: ~100 real IPL players, fields per the sample JSON I'm providing (`teamName`, `playerName`, `playerImgUrl`, `playerImgLocalPath`, `playerExpertIn`, `nationality`, `experienceYears`, `basePrice` as a currency string like `"₹21 Cr"`, `ratingOutOf10`). Store this as a **static, read-only seed table** shared across all rooms (the catalog itself doesn't change per room — only each room's per-player auction *outcome* — price/status/winner — is room-specific). Design the schema so this distinction (global catalog vs. per-room auction state) is explicit and clean, not duplicated 100-rows-per-room.
- Decide and document: do you store `basePrice` as the original string, or normalize it to an integer (e.g. crores as a number) for actual bid-comparison math? (Hint: you need real number comparisons for bid validation — pick the right representation and convert/display the ₹X Cr string only at the UI layer.)
- Rooms, room participants (with their budget/squad-size config and current remaining budget), per-room player auction state, bids (full history, not just current highest), and whatever else the schema needs for the above to work correctly.

---

## Constraints & Things I Need You To Decide (and justify, don't just assume silently)

1. **I'm using Supabase** (Postgres + Realtime + Auth if needed) as the database/backend platform. Use Supabase Realtime (`postgres_changes` or `broadcast` channels — pick deliberately) for the live sync instead of a custom Socket.io server, since Supabase doesn't run a persistent Node process for me. Explain the tradeoff vs. a custom WebSocket server in the architecture notes.
2. **Server-authoritative timer without a persistent Node server is the hardest problem here.** Supabase alone has no built-in cron/scheduled-job-per-timer primitive suited to "resolve this exact player in exactly 27 seconds." Propose and implement a concrete, real solution — options to evaluate (don't just default to the first one, reason about it): (a) Supabase Edge Functions + `pg_cron` polling every few seconds to resolve any player whose `endsAt` has passed, (b) a lightweight separate always-on Node process (e.g. on Render/Railway) that owns timers and writes resolutions back to Supabase, (c) database-level: a Postgres function + trigger-adjacent polling approach. Pick the one that's actually correct and buildable, and explain why you rejected the others.
3. Authentication: Implement full Supabase Email/Password Authentication. Provide sign in / sign up toggle views, developer quick logins on localhost (using pre-seeded accounts test@test.com, test@test1.com, test@test2.com, test@test3.com with password 123789), and synchronization of active sessions using React Context and Next.js middleware token refresh.
4. Write **Row Level Security policies** appropriate for this use case. RLS must be recursion-free (e.g. using helper functions like `is_room_member(room_id)` to bypass recursion), ensuring only validated participant sessions can view game states, public catalog items are open, and direct writes to main tables are blocked. Direct write/updates must happen only through validated server-side RPC functions.
5. Give me a `.env.example` and clear setup steps (Supabase project creation, running migrations/schema, running the seed script).

## Deliverables

1. Full Supabase SQL schema (migration file(s)), including enums, tables, indexes, RLS policies, and any Postgres functions needed for atomic bid validation.
2. The chosen timer/resolution mechanism, fully implemented (Edge Function code, or the separate Node service code, or whatever you decided in point 2 above).
3. A seed script that loads the 100-player JSON dataset (I will provide the actual file) into the player catalog table.
4. A typed service/API layer (TypeScript) exposing: createRoom, joinRoom, startAuction, placeBid, pauseAuction, resumeAuction, forceResolveCurrentPlayer, getRoomSnapshot, getResults — whatever functions the frontend will need, with clear types.
5. A short `ARCHITECTURE.md` explaining: the realtime strategy and why, the timer/resolution strategy and why, the concurrency-safety mechanism for bids and why it's actually safe, the RLS model, and known limitations.
6. Ask me clarifying questions before you start if anything above is still ambiguous to you — do not silently assume on anything that affects correctness (budget math, tie-breaking rules on simultaneous equal bids, player ordering, exact resolution mechanism feasibility on free-tier Supabase, etc.).

I will hand you the 100-player JSON dataset directly when you're ready for the seed step. Sample record shape:
```json
{
  "teamName": "RCB",
  "playerName": "Virat Kohli",
  "playerImgUrl": "https://documents.iplt20.com/ipl/IPLHeadshot2026/2.png",
  "playerImgLocalPath": "images/RCB/Virat_Kohli.png",
  "playerExpertIn": "Batter",
  "nationality": "India",
  "experienceYears": 18,
  "basePrice": "₹21 Cr",
  "ratingOutOf10": 9.0
}
```
