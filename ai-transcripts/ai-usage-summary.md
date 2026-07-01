# 11Auction — AI Usage & Technical Design Summary

This document outlines the collaborative workflow between the developer and AI agents, the architectural choices adopted from the system design, core technical assumptions, and system tradeoffs. This summary acts as an engineering map for the 11Auction hiring project.

---

## 🛠️ AI Tools & Collaboration Overview

During the design, development, and refactoring of 11Auction, three distinct AI tools were utilized:
1. **Gemini Antigravity CLI**: Served as the primary agentic assistant. Responsible for major codebase reorganizations (monorepo file system restructuring into isolated `Frontend/`, `Backend/`, and `Database/` workspaces), solving Next.js Turbopack compiler path conflicts, implementing early squad-completion logic, and building the final multiplayer ranking dashboard.
2. **Claude Code**: Utilized for structural UI/UX overhauls, designing the Vercel-inspired dark/light theme engine, and writing clean animatable React layouts to prevent layout shifts.
3. **Cursor**: Used as an IDE autocomplete and helper for inline HTML adjustments, Tailwind configuration tweaks, and fast file-template generation.

---

## 🤖 What AI Helped With

### 1. Initial Architecture & Database Schema
* Automated the creation of the initial SQL migrations (`001_schema.sql`, `002_rls_policies.sql`, `003_functions.sql`), defining core tables, indexes, and enums.
* Built the data pipeline scripts (`generate_seed.mjs`) to convert the raw player catalog dataset (`ipl_2026_auction_dataset.json`) from human-readable strings to clean numeric values inside the database seed file (`seed.sql`).

### 2. Realtime WebSocket Synchronization
* Configured the client-side realtime listeners in `realtime.ts` subscribing to Supabase `postgres_changes` channels for four target tables: `rooms`, `room_participants`, `room_players`, and `bids`.
* Configured `REPLICA IDENTITY FULL` on gameplay tables. This database configuration is required to force Supabase Realtime to push the complete old/new row states to RLS-restricted channels, ensuring all clients stay synchronized on budget deductions and bid histories.

### 3. UI/UX Refactoring & Layout Stability
* Rewrote `AuctionView.tsx`, `CountdownTimer.tsx`, and `BidHistory.tsx` to utilize layout-locked flex layouts. Pinned sections (`shrink-0`) and explicit layout constraints ensure zero layout shifts occur during rapid bidding.
* Built a horizontal bid timeline that dynamically centers the highest (newest) bid chip and fades out older bids, complete with custom GPU-accelerated enter animations.

### 4. Database Security & RLS Debugging
* Solved a critical infinite recursion bug in the Supabase Row-Level Security (RLS) policy for the `room_participants` table.
* Designed the isolated `is_room_member(p_room_id)` helper function. By declaring this function as `SECURITY DEFINER` and pointing it to `public`, lookup queries bypass standard RLS checks, breaking circular dependency evaluation loops.

### 5. Automated Game Engine Logic
* Implemented early-completion checks inside `advance_to_next_player(p_room_id)` to check if all participants' squads are full before starting another round.
* Designed and built the results-ranking dashboard (`ResultsView.tsx`) calculating squad balance, value efficiency, and veteran/international star power scores.

---

## 🏛️ Key Architectural Highlights

### 1. Hybrid Timer Resolution Model
Because Supabase operates serverlessly without persistent background timer processes, 11Auction utilizes a robust, three-tiered hybrid resolution approach:
* **Client-Side Visuals**: A local JavaScript `setInterval` countdown ticks down cosmetically for the UI.
* **Client-Triggered RPC**: When a client's timer hits zero, the client browser automatically triggers the `check_and_resolve()` Supabase RPC. The database function validates the actual timestamp (`ends_at <= now()`) before modifying states, ensuring client clock tampering cannot cheat the system.
* **pg_cron safety net**: If all clients in a room suddenly lose connection during an active bid, a background pg_cron job (`resolve_expired_auctions()`) runs every 60 seconds as a safety sweeper to resolve orphaned players and prevent infinite active states.

### 2. Concurrency Safety with Atomic Row Locks
To prevent race conditions during sub-second, multiplayer bidding wars (such as "double-spending" or bidding after a round expires), the `place_bid()` RPC function implements explicit row locking:
```sql
-- Prevents concurrent status updates or active player changes
SELECT * INTO v_rp FROM room_players WHERE id = p_room_player_id FOR UPDATE;

-- Locks the bidder's row, preventing concurrent transactions from overspending remaining budget
SELECT * INTO v_participant FROM room_participants WHERE id = p_participant_id FOR UPDATE;
```
This guarantees that concurrent database write transactions are executed sequentially, protecting budget calculations and bid limits.

### 3. High-Dopamine Player Ordering
To make the gameplay engaging, rooms can choose a `CATEGORY` ordering strategy:
* Players are grouped into rating tiers.
* For each auction slot, the database executes a weighted interleave draw (75% probability from high/medium rating, 25% from low rating).
* This ensures marquee players are evenly distributed throughout the game, and since the tiers are shuffled independently per-room, the auction order is unique every time.

---

## 📝 Core Assumptions Made

1. **Active Client Presence**: It is assumed that at least one client remains connected in the room to trigger the RPC `check_and_resolve()` upon timer expiration, ensuring immediate round transitions. If all clients disconnect, the room falls back to the `pg_cron` sweeper, which may take up to a minute to resolve.
2. **Local Client Clock Bounds**: It is assumed that client clocks will not drift excessively from the database server's time. Visual clock synchronization is maintained via NTP offset calculation (`serverOffset` derived from the database response header time), but extreme local client time-skewing may cause visual jumps.
3. **Fixed Squad Budgets and Limits**: It is assumed that room rules (max squad size and budgets) are locked at room creation and cannot be modified mid-game.

---

## ⚖️ Tradeoffs Made

### 1. Supabase Realtime vs. Custom Socket Server
* **Tradeoff**: We opted for Supabase's built-in `postgres_changes` realtime engine rather than hosting a dedicated WebSocket server (e.g. Socket.io, Node/Go backend).
* **Pros**: Substantially reduces infrastructure footprint and deployment complexity; keeps the backend database-centric and serverless; inherits database schema security policies natively.
* **Cons**: Payload overhead is higher, as Supabase Realtime pushes the entire row data on update. Direct PostgreSQL connection counts from realtime listeners could saturate database limits under extremely large concurrent player volumes.

### 2. Database RPCs vs. API Server Middleware Layer
* **Tradeoff**: The app executes state mutations (like placing bids, pausing, and resuming) via database RPC functions instead of going through a proxy backend API server.
* **Pros**: Low latency (client talks directly to database layers); atomic safety via raw Postgres transactions; direct row locking.
* **Cons**: The database is exposed to direct function execution, making it harder to implement custom application-level rate limiting or anti-spam firewalls.

### 3. No Bid Retraction Policy
* **Tradeoff**: The system does not allow retracting bids once placed.
* **Pros**: Simulates the high-pressure atmosphere of real-world sports auctions.
* **Cons**: Higher user friction in case of accidental clicks, placing the responsibility of error handling entirely on client-side confirmation flows.

---

## ⚠️ Known System Limitations / Future Improvements

1. **pg_cron Resolution Interval**: The database safety-net sweeper is limited by pg_cron's minimum scheduling interval of 60 seconds. An abandoned game room could stay stalled on an active player for up to a minute.
2. **Direct Connection Limits**: Because frontend clients execute RPC commands directly to Supabase, each active room holds direct database connections. Under high concurrent room loads, connection pool saturation could occur unless a connection pooling proxy (like Supabase Supavisor) is configured.
3. **Anti-Spam Bid Protection**: There is currently no database-level rate limiting on `place_bid()`. A malicious client could send spam requests to drive up prices. 
