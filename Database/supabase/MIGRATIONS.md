# Database Migrations — Apply Order & Reference

This project uses **Supabase Email/Password Authentication** to secure rooms and transactions. RLS is enabled on all tables, requiring players to register/login before entering lobbies and playing. Every write transaction is initiated via `SECURITY DEFINER` RPC functions that execute operations on behalf of authenticated users, validating actions using `auth.uid()`.

There are two ways to set up the database.

---

## Option A — Fresh database (recommended)

Run these once in the Supabase **SQL Editor**, in order:

1. **`combined_migration.sql`** — Core schema for a new project: tables, enums, indexes, RPC functions (rooms, bidding, resolution, ordering), room-options columns, the 100-player seed, and the realtime publication.
2. **`005_chat.sql`** — Chat table, `send_chat` RPC, and realtime config for chat.
3. **`008_auth_profiles.sql`** — Profiles table (`id` FK to `auth.users`), signup trigger to automatically sync new users to the public schema, and initial RLS policies.
4. **`009_fix_rls.sql`** — Recursion-free RLS policies using `is_room_member(room_id)` helper function. Extends RLS security to authenticated users and handles public room lists for anonymous users.
5. **`migrations/010_auto_complete_and_rankings.sql`** — Auto-complete logic when all squads are full, plus the rankings calculation SQL function.
6. **`dev_functions.sql`** — `start_auction_dev` (allows starting the auction with a single participant for local testing).
7. *(optional)* **`004_cron.sql`** — pg_cron safety-net sweeper (`resolve_expired_auctions()` every 60s). Requires the `pg_cron` extension.

---

## Option B — Incremental migrations (`migrations/`)

For an existing database, apply only what you're missing. Files are ordered:

| File | What it does |
|------|--------------|
| `001_schema.sql` | Core tables, enums, indexes. |
| `002_rls_policies.sql` | Legacy RLS policies. Superseeded by `009_fix_rls.sql`. |
| `003_functions.sql` | Core RPCs (`place_bid`, `check_and_resolve`, etc.). |
| `004_cron.sql` | pg_cron safety-net sweeper. |
| `005_chat.sql` | Chat table + `send_chat` + realtime. |
| `006_realtime_fix.sql` | Sets `REPLICA IDENTITY FULL` on realtime tables, ensuring budget updates reach all clients. |
| `007_room_options.sql` | Adds `rooms.is_public` and `rooms.player_order`, updates `create_room` and seeds default players. |
| `008_auth_profiles.sql` | **New Auth Hook:** Creates `profiles` table to track display names and triggers profile creation when new users sign up via Supabase auth. |
| `009_fix_rls.sql` | **RLS & Recursion Fix:** Implements `is_room_member()` helper function to prevent infinite RLS recursion in `room_participants`, grants `authenticated` SELECT access to game state, and configures public room visibility for `anon` users. |
| `010_auto_complete_and_rankings.sql` | **Auto-Complete & Rankings:** Auto-completes the auction when all participant squads are full, and adds `compute_auction_rankings()` to calculate squad composition, value efficiency, and star power scores. |

---

## Player catalog seed

- The 100-player catalog lives in `seed.sql` (also embedded in `combined_migration.sql`).
- `seed.sql` is **generated** from `data-extraction/ipl_2026_auction_dataset.json`. Regenerate it after editing the dataset:

  ```bash
  node data-extraction/generate_seed.mjs
  ```

  The generator derives the numeric `base_price_lakhs` (used for bid math) from the display string (`"₹21 Cr"` → `2100`) and is idempotent (only seeds when the `players` table is empty).

---

## Realtime checklist

For live updates to work, every gameplay table must be in the `supabase_realtime` publication **and** have `REPLICA IDENTITY FULL`:

- `rooms`, `room_participants`, `room_players`, `bids`, `room_chats`

`combined_migration.sql` + `005_chat.sql` + `006_realtime_fix.sql` + `009_fix_rls.sql` together ensure this. If balances or bids aren't syncing across browsers, re-run `006_realtime_fix.sql` or verify RLS configurations.

---

## Auth Settings Configuration

To ensure instant access upon registration:
1. Open the **Supabase Dashboard** for your project.
2. Go to **Authentication** -> **Settings**.
3. Under **User Sign Up**, find **Confirm Email** (or **Enable email confirmations**).
4. **Disable** it (toggle OFF) so users can sign up and get immediate access without waiting for an email verification token.
