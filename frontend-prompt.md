# FRONTEND PROMPT
### For: Claude Opus 4.6 in terminal / Antigravity — Mini Realtime Auction Room (IPL Edition)

---

## Context

I am building a take-home hiring assignment called **"Mini Realtime Auction Room."** Frontend design, responsiveness *(desktop-only is explicitly fine per the spec — do not spend time on mobile)*, usability, and polish are all explicitly graded. The UI needs to feel **live, competitive, and reliable** — that phrase is from the actual evaluation brief, treat it literally: loading states, empty states, error states, and smooth realtime updates all matter as much as the happy path.

This is an IPL-themed auction game: 3–5 friends per room, each bidding for themselves under a custom squad name (no real IPL team binding), on a shared pool of ~100 real IPL players, one at a time, with a live countdown timer, until the pool is exhausted.

The backend (Supabase + realtime layer) is being built separately — assume it exposes: room creation/joining, a live room snapshot subscription (current player, current highest bid + full bid history, timer end timestamp, room status, all participants' remaining budget/squad count), and actions: placeBid, startAuction, pauseAuction, resumeAuction, forceResolveCurrentPlayer. I will give you the exact TypeScript types/API contract once the backend is finalized — for now, build against a clearly-defined mock/interface so the two halves slot together cleanly.

This is conceptually similar to **11auction.com** in spirit (a viral cricket-auction site) but is an independent build, not a clone.

## Your Job In This Prompt

Build the **entire frontend**: every screen, every state (loading/empty/error), and the realtime-driven auction experience. No backend logic — call the provided API contract, treat it as the source of truth, and never compute "who's winning" or "is time up" independently of what the server snapshot says.

---

## Screens Required

### 1. Landing / Home page
Reference: attached screenshot of 11auction.com's dashboard (dark theme, gold/amber accent, card-based). Adapt — don't clone — that visual language:
- Dark background, warm gold/amber accent color for primary actions and highlights, clean sans-serif typography.
- Simple entry point: "Create Room" and "Join Room" as the two primary actions, front and center. No login/signup wall — this matches the assignment's "session identity is enough" approach.
- Keep this screen light — it's not the focus of the grading, the auction room is. Don't overbuild it.

### 2. Create Room screen
Admin sets up a new room:
- Room name
- Purse budget per participant (default ₹120 Cr, editable)
- Max squad size per participant (default 18, editable)
- Bid timer duration per player (default 30s, editable)
- On submit: generates a shareable room code/link, takes admin into the Lobby as the first participant.

### 3. Join Room screen
Reference: attached "joining rooms" screenshot for the general *card-based, status-badge* visual pattern (e.g. "WAITING" pill, room code, participant count) — adapt the visual language, not the literal multi-match/multi-room browsing structure, since this app only needs single-room join-by-code, not a whole match browser.
- Enter room code (or arrive via a direct shareable link with the code pre-filled).
- Enter display name + custom squad name (e.g. "Thunder XI") — this is their identity for this room, not a real IPL team.
- Show a clear error state if the room code doesn't exist or the room has already started/completed (can't join an in-progress or finished auction — confirm this restriction with me if backend allows late joins, otherwise treat it as the default).

### 4. Lobby screen (room status: LOBBY)
- Shows the room code prominently (for sharing) and a copy-link button.
- List of joined participants with their squad names.
- Shows the configured rules (budget, squad cap, timer duration) so everyone can see them before starting.
- Admin sees a "Start Auction" button; participants see a "Waiting for admin to start..." state instead.
- Empty state: if only the admin has joined so far, show something better than a blank list (e.g. "Share the room code to invite friends").

### 5. Auction room screen (room status: AUCTION) — THE CORE SCREEN
**This must closely follow my hand-drawn wireframe (attached).** Build this layout precisely, then apply real visual polish on top of the wireframe's structure — don't deviate from the structure without telling me why.

Layout, left to right:

**Left column — "My Squad"**
- A vertical list of player slots showing players *this specific participant* has won so far in the room (their own squad-in-progress).
- Show empty/placeholder slots up to their max squad size so progress is visually obvious (e.g. 3 filled, 15 empty outlines if cap is 18).
- Each filled slot: player thumbnail + name + price paid.

**Center column — the live auction itself**
- Top: "Currently auctioning" card showing the active player's photo, name, role (`playerExpertIn`), nationality, experience, rating, and base price. This is the `pic` + "on Going player details" block from my wireframe.
- Below that: an "Auction Log" labeled panel containing:
  - A prominent circular **countdown timer** (matches my wireframe's double-ring circle) — this must visually update smoothly (not jump every second jankily) and must be driven by the server's `endsAt` timestamp, not a client-only countdown that could drift or be manipulated. Handle clock drift gracefully (the backend will provide a server-time reference — use it to correct the client's local countdown).
  - Live bid history feed (who bid what, most recent on top or bottom — pick one and be consistent), updating in realtime for everyone in the room.
  - The current highest bid amount, visually prominent and impossible to miss, clearly showing who currently holds it.
  - Below the timer: **bid amount buttons** (4 buttons, matching my wireframe's 2x2 grid) — these should be smart increment buttons (e.g. +1 Cr / +2 Cr / +5 Cr / +10 Cr on top of the current highest bid, or your own well-reasoned increment scheme) rather than requiring free-text entry, since fast tap-to-bid is the actual feel of a live auction. Disable a bid button if it would exceed the participant's remaining budget; show *why* it's disabled on hover/tap, don't just silently grey it out.
  - When this participant places a bid, give immediate visual feedback (a flash/highlight) even before the server confirms, then reconcile with the real server state when it arrives — but never let optimistic UI show something the server didn't actually accept; roll back cleanly with a clear message if a bid is rejected (e.g. someone else bid higher in the same instant, or budget exceeded).

**Right column**
- `balance` panel: this participant's remaining budget, prominently shown, updating live as they win players.
- `Teams/player info` panel: a scrollable view of all OTHER participants in the room — their squad name, players won so far, and remaining budget (so everyone can see their rivals' status, which is core to the "competitive" feel).
- `chat` panel: this is listed as an OPTIONAL feature in the spec, not core. **Do not build real chat functionality** — instead, stub the panel with a clean "Coming soon" placeholder OR skip it entirely and use that space for something already-required (e.g. expand the "Teams/player info" panel). Ask me which before you decide, don't silently drop a wireframed panel without flagging it.

**Sold/Unsold resolution moment**: when the timer hits zero, there must be a clear, satisfying visual transition (not an abrupt UI flicker) showing the result — "SOLD to [squad name] for ₹X Cr" or "UNSOLD" — before the screen advances to the next player. Give this a real moment, it's the emotional payoff of the whole product.

**Admin-only additions** on this same screen (per my decision: same screen for everyone, admin gets extra controls layered on):
- Pause/Resume button
- Skip/force-resolve current player button
- End auction early button
- These should be visually distinct (e.g. a small admin toolbar) but not dominate the layout for participants who don't see them.

### 6. Results screen (room status: COMPLETED)
- Final squad for every participant: full player list with price paid, total spent, remaining budget.
- Make this shareable-feeling — this is the natural "show your friends" moment of the whole product, treat it with some visual care, not just a plain table (though a clean table is a fine baseline if time is short — polish it if time allows).

---

## Cross-cutting requirements (graded explicitly, do not skip)

- **Loading states**: every screen that waits on data (joining a room, room snapshot loading, results computing) needs a real loading state — skeleton or spinner, not a blank white flash.
- **Empty states**: lobby with no other participants yet, "My Squad" with zero players won yet, bid history with zero bids yet on a fresh player — all need considered empty states, not raw blank space.
- **Error states**: invalid room code, room already started, bid rejected (with the actual reason from the server, not a generic "error"), connection lost/reconnecting to realtime.
- **Realtime resilience**: if a participant's connection drops and reconnects, they should resync to the actual current server state cleanly, not show stale data.
- **Visual identity**: dark theme, gold/amber accent (matching the reference screenshots' palette), clean and modern, but this is YOUR design system to build well — don't just reskin the wireframe with no real typography/spacing/color decisions. Treat the wireframe as a structural blueprint, not a final visual.
- Desktop-only is fine; do not spend any effort on mobile responsiveness.

## What I need from you before/while building

- Confirm the bid-increment-button scheme you'll use (flat amounts vs. percentage vs. something else) before building it, and why.
- Tell me clearly what you decide on the chat panel question above.
- Flag anything in my wireframe that's structurally ambiguous rather than guessing silently.
- Once the backend's real API contract/types are ready, I'll share them with you to wire up — until then, build against a clearly stubbed interface so swapping in the real backend is a clean, mechanical step, not a rewrite.

I'm attaching: my hand-drawn auction-screen wireframe, the 11auction.com room-joining reference screenshot, and the 11auction.com landing-page reference screenshot — for visual/structural reference only, not literal copying.
