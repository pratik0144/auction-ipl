// ============================================================================
// IPL Auction Game - Dynamic Bid Calculator
// ============================================================================

export interface BidOption {
  increment: number;
  total: number;
}

/**
 * Round a value to an auction-friendly number.
 *   < 100  → multiple of 5
 *   < 500  → multiple of 10
 *   < 1000 → multiple of 25
 *   ≥ 1000 → multiple of 50
 */
function roundToAuctionFriendly(value: number): number {
  if (value < 100) return Math.max(5, Math.round(value / 5) * 5);
  if (value < 500) return Math.max(10, Math.round(value / 10) * 10);
  if (value < 1000) return Math.max(25, Math.round(value / 25) * 25);
  return Math.max(50, Math.round(value / 50) * 50);
}

/**
 * Get raw increment percentages based on the player's base-price tier.
 *
 *   Budget  (≤ 100 L) : ~10-50 %
 *   Mid     (101-500)  : ~5-25 %
 *   Premium (501-1500) : ~3-15 %
 *   Marquee (> 1500)   : ~2-10 %
 */
function getTierPercentages(basePrice: number): number[] {
  if (basePrice <= 100) return [0.10, 0.20, 0.35, 0.50];
  if (basePrice <= 500) return [0.05, 0.10, 0.18, 0.25];
  if (basePrice <= 1500) return [0.03, 0.07, 0.11, 0.15];
  return [0.02, 0.04, 0.07, 0.10];
}

const MIN_INCREMENT = 5;
const TARGET_OPTIONS = 4;

/**
 * Compute smart bid options for the auction UI.
 *
 * @param basePrice         - Player's base price in lakhs
 * @param currentHighestBid - Current highest bid in lakhs (0 if no bids yet)
 * @param remainingBudget   - Bidder's remaining budget in lakhs
 * @returns Exactly up to 4 distinct `{ increment, total }` options,
 *          filtered by budget. Returns [] when no valid bid is possible.
 */
export function computeBidOptions(
  basePrice: number,
  currentHighestBid: number,
  remainingBudget: number,
): BidOption[] {
  const effectiveBid = Math.max(currentHighestBid, basePrice);
  const percentages = getTierPercentages(basePrice);

  // Build raw increments from tier percentages
  const rawIncrements = percentages.map((pct) => {
    const raw = basePrice * pct;
    const rounded = roundToAuctionFriendly(raw);
    return Math.max(MIN_INCREMENT, rounded);
  });

  // De-duplicate while preserving order, then collect distinct values
  const seen = new Set<number>();
  const distinctIncrements: number[] = [];

  for (const inc of rawIncrements) {
    if (!seen.has(inc)) {
      seen.add(inc);
      distinctIncrements.push(inc);
    }
  }

  // If we lost duplicates, try to fill back up to TARGET_OPTIONS
  // by inserting intermediate or extended values
  if (distinctIncrements.length < TARGET_OPTIONS) {
    // Generate additional candidates: halfway between neighbours & beyond max
    const candidates: number[] = [];

    for (let i = 0; i < distinctIncrements.length - 1; i++) {
      const mid = (distinctIncrements[i] + distinctIncrements[i + 1]) / 2;
      candidates.push(roundToAuctionFriendly(mid));
    }

    // Extend beyond the largest existing increment
    const maxInc = distinctIncrements[distinctIncrements.length - 1];
    candidates.push(roundToAuctionFriendly(maxInc * 1.5));
    candidates.push(roundToAuctionFriendly(maxInc * 2));

    // Also try the minimum increment
    candidates.push(MIN_INCREMENT);

    for (const c of candidates) {
      if (!seen.has(c) && c >= MIN_INCREMENT) {
        seen.add(c);
        distinctIncrements.push(c);
      }
      if (distinctIncrements.length >= TARGET_OPTIONS) break;
    }

    // Sort so options are always ascending
    distinctIncrements.sort((a, b) => a - b);
  }

  // Take up to TARGET_OPTIONS
  const finalIncrements = distinctIncrements.slice(0, TARGET_OPTIONS);

  // Build options, filtering by budget
  const options: BidOption[] = [];
  for (const increment of finalIncrements) {
    const total = effectiveBid + increment;
    if (total <= remainingBudget) {
      options.push({ increment, total });
    }
  }

  // If we have fewer than TARGET_OPTIONS valid options,
  // ensure the minimum possible bid is included
  if (options.length < TARGET_OPTIONS && options.length > 0) {
    const minTotal = effectiveBid + MIN_INCREMENT;
    if (
      minTotal <= remainingBudget &&
      !options.some((o) => o.total === minTotal)
    ) {
      options.unshift({ increment: MIN_INCREMENT, total: minTotal });
      // Re-sort and trim
      options.sort((a, b) => a.total - b.total);
      // Keep only TARGET_OPTIONS
      if (options.length > TARGET_OPTIONS) {
        options.length = TARGET_OPTIONS;
      }
    }
  }

  // Edge case: no options survived the budget filter but the minimum bid fits
  if (options.length === 0) {
    const minTotal = effectiveBid + MIN_INCREMENT;
    if (minTotal <= remainingBudget) {
      options.push({ increment: MIN_INCREMENT, total: minTotal });
    }
  }

  return options;
}
