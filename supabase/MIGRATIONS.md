# Database Migrations — Apply Order & Reference

This project has **no user login**: the browser uses the Supabase **anon** key
with a `localStorage` UUID as identity. Reads use permissive (`TO anon`)
policies and every write goes through a `SECURITY DEFINER` RPC.

There are two ways to set up the database.

---

## Option A — Fresh database (recommended)

Run these once in the Supabase **SQL Editor**, in order:

1. **`combined_migration.sql`** — everything for a new project: tables + enums +
   indexes, permissive **anon** RLS, all RPC functions (rooms, bidding,
   resolution, ordering), the room-options columns, the 100-player seed, and the
   realtime publication with `REPLICA IDENTITY FULL`.
2. **`005_chat.sql`** — chat table + `send_chat` RPC + realtime for chat.
3. **`dev_functions.sql`** — `start_auction_dev` (lets you start with a single
   participant for solo testing via `npm run dev:test`).
4. *(optional)* **`004_cron.sql`** — pg_cron safety-net sweeper
   (`resolve_expired_auctions()` every 60s). Requires the `pg_cron` extension.

`combined_migration.sql` is idempotent-friendly for a clean project but is **not**
meant to be re-run on a populated database — use the incremental files below for
upgrades.

---

## Option B — Incremental migrations (`migrations/`)

For an existing database, apply only what you're missing. Files are ordered:

| File | What it does |
|------|--------------|
| `001_schema.sql` | Core tables, enums, indexes. |
| `002_rls_policies.sql` | **Legacy** authenticated/`auth.uid()` policies. **Superseded** — the live app uses the permissive `anon` policies from `combined_migration.sql`. Skip on anon-only setups. |
| `003_functions.sql` | Core RPCs (`place_bid`, `check_and_resolve`, etc.). |
| `004_cron.sql` | pg_cron safety-net sweeper. |
| `005_chat.sql` | Chat table + `send_chat` + realtime. |
| `006_realtime_fix.sql` | **Live balance sync fix.** Sets `REPLICA IDENTITY FULL` on realtime tables and guarantees they're in the `supabase_realtime` publication, so participant budget UPDATEs reach **every** client (not just the admin). Idempotent. |
| `007_room_options.sql` | Adds `rooms.is_public` + `rooms.player_order`, updates `create_room` to accept them, and adds `seed_room_players()` — the `RANDOM` / `CATEGORY` ("high-dopamine") ordering used by `start_auction` / `start_auction_dev`. Idempotent. |

### Upgrading an older deployment

If your project predates this release, the two migrations you most likely need are:

```text
006_realtime_fix.sql   -- fixes "balances only update on the admin's screen"
007_room_options.sql   -- public/private + player-order options
```

Both are safe to run on a live database (`ADD COLUMN IF NOT EXISTS`,
`CREATE OR REPLACE`, guarded publication changes).

---

## Player catalog seed

- The 100-player catalog lives in `seed.sql` (also embedded in
  `combined_migration.sql`).
- `seed.sql` is **generated** from `data-extraction/ipl_2026_auction_dataset.json`.
  Regenerate it after editing the dataset:

  ```bash
  node data-extraction/generate_seed.mjs
  ```

  The generator derives the numeric `base_price_lakhs` (used for bid math) from
  the display string (`"₹21 Cr"` → `2100`) and is idempotent (only seeds when the
  `players` table is empty).

---

## Realtime checklist

For live updates to work, every gameplay table must be in the
`supabase_realtime` publication **and** have `REPLICA IDENTITY FULL`:

- `rooms`, `room_participants`, `room_players`, `bids`, `room_chats`

`combined_migration.sql` + `005_chat.sql` + `006_realtime_fix.sql` together
ensure this. If balances or bids aren't syncing across browsers, re-run
`006_realtime_fix.sql`.
