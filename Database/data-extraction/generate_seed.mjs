#!/usr/bin/env node
// =============================================================================
// generate_seed.mjs — Generate supabase/seed.sql from the player JSON dataset.
//
// Source of truth: data-extraction/ipl_2026_auction_dataset.json
// Output:          supabase/seed.sql
//
// Run:  node data-extraction/generate_seed.mjs
//
// `basePrice` in the dataset is a DISPLAY string ("₹21 Cr", "₹75 Lakh"). The
// auction's bid math needs a numeric value, so we derive `base_price_lakhs`
// (1 Cr = 100 Lakh) and keep the original string as `base_price_display`.
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const JSON_PATH = join(__dirname, 'ipl_2026_auction_dataset.json');
const OUT_PATH = join(ROOT, 'supabase', 'seed.sql');

const TEAM_FULL_NAMES = {
  RCB: 'Royal Challengers Bengaluru',
  GT: 'Gujarat Titans',
  SRH: 'Sunrisers Hyderabad',
  RR: 'Rajasthan Royals',
};

const VALID_ROLES = new Set([
  'Batter',
  'Wicketkeeper-Batter',
  'All-rounder',
  'Pace Bowler',
  'Spin Bowler',
  'Bowler',
]);

/** "₹21 Cr" -> 2100 ; "₹75 Lakh" -> 75 ; "₹1.25 Cr" -> 125 */
function basePriceToLakhs(display) {
  const cleaned = display.replace('₹', '').trim();
  const m = cleaned.match(/^([0-9]+(?:\.[0-9]+)?)\s*(Cr|Lakh)$/i);
  if (!m) throw new Error(`Unrecognised basePrice format: "${display}"`);
  const value = parseFloat(m[1]);
  const lakhs = /cr/i.test(m[2]) ? value * 100 : value;
  return Math.round(lakhs);
}

const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;

function rowFor(p) {
  if (!VALID_ROLES.has(p.playerExpertIn)) {
    throw new Error(`Invalid role "${p.playerExpertIn}" for ${p.playerName}`);
  }
  const lakhs = basePriceToLakhs(p.basePrice);
  const rating = Number(p.ratingOutOf10).toFixed(1);
  return (
    `  (${sqlStr(p.teamName)}, ${sqlStr(p.playerName)}, ${sqlStr(p.playerImgUrl)}, ` +
    `${sqlStr(p.playerExpertIn)}, ${sqlStr(p.nationality)}, ${p.experienceYears}, ` +
    `${lakhs}, ${sqlStr(p.basePrice)}, ${rating})`
  );
}

const COLS =
  'team_name, player_name, player_img_url, player_expert_in, nationality, ' +
  'experience_years, base_price_lakhs, base_price_display, rating';

function main() {
  const players = JSON.parse(readFileSync(JSON_PATH, 'utf8')).players;

  // Group by team, preserving dataset order.
  const byTeam = new Map();
  for (const p of players) {
    if (!byTeam.has(p.teamName)) byTeam.set(p.teamName, []);
    byTeam.get(p.teamName).push(p);
  }

  const blocks = [];
  for (const [team, list] of byTeam) {
    const full = TEAM_FULL_NAMES[team] ?? team;
    blocks.push(
      `  -- ${full} (${team}) — ${list.length} players\n` +
        `  INSERT INTO players (${COLS})\n  VALUES\n` +
        list.map(rowFor).join(',\n') +
        ';'
    );
  }

  const sql =
    `-- =============================================================================\n` +
    `-- IPL 2026 Auction Player Catalog Seed Data\n` +
    `-- Auto-generated from ipl_2026_auction_dataset.json by generate_seed.mjs\n` +
    `-- DO NOT EDIT BY HAND — re-run: node data-extraction/generate_seed.mjs\n` +
    `-- Total players: ${players.length}\n` +
    `-- =============================================================================\n\n` +
    `-- Idempotent: only seeds when the catalog is empty, so it is safe to re-run\n` +
    `-- and will not disturb an in-progress room.\n` +
    `DO $$\nBEGIN\n` +
    `  IF EXISTS (SELECT 1 FROM players) THEN\n` +
    `    RAISE NOTICE 'players catalog already seeded — skipping';\n` +
    `    RETURN;\n` +
    `  END IF;\n\n` +
    blocks.join('\n\n') +
    `\nEND $$;\n`;

  writeFileSync(OUT_PATH, sql, 'utf8');
  console.log(`Wrote ${OUT_PATH} (${players.length} players across ${byTeam.size} teams)`);
}

main();
