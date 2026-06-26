// ============================================================================
// IPL Auction Game - Utility Functions
// ============================================================================

/**
 * Format price in lakhs to display string
 * 2100 → '₹21 Cr', 75 → '₹75 L', 200 → '₹2 Cr', 150 → '₹1.5 Cr'
 */
export function formatPrice(lakhs: number): string {
  if (lakhs >= 100) {
    const crores = lakhs / 100;
    const display =
      crores % 1 === 0
        ? crores.toString()
        : crores.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
    return `₹${display} Cr`;
  }
  return `₹${lakhs} L`;
}

/**
 * Parse display price string to lakhs
 * '₹21 Cr' → 2100, '₹75 Lakh' → 75, '₹75 L' → 75
 */
export function parsePrice(display: string): number {
  const cleaned = display.replace('₹', '').trim();
  if (cleaned.includes('Cr')) {
    const num = parseFloat(cleaned.replace('Cr', '').trim());
    return Math.round(num * 100);
  }
  if (cleaned.includes('Lakh') || cleaned.includes('L')) {
    const num = parseFloat(cleaned.replace(/Lakh|L/g, '').trim());
    return Math.round(num);
  }
  return 0;
}

/**
 * Generate a 6-character uppercase alphanumeric room code
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Get star representation for a rating (out of 10)
 * Converts to 5-star scale with half-star support
 */
export function getRatingStars(rating: number): string {
  const maxStars = 5;
  const scaledRating = rating / 2;
  const fullStars = Math.floor(scaledRating);
  const halfStar = scaledRating % 1 >= 0.5 ? 1 : 0;
  const emptyStars = maxStars - fullStars - halfStar;
  return '★'.repeat(fullStars) + (halfStar ? '½' : '') + '☆'.repeat(emptyStars);
}

/**
 * Calculate seconds remaining until a given timestamp
 * @param endsAt - ISO timestamp string
 * @param serverOffset - milliseconds offset to adjust for server/client clock drift
 */
export function getTimeRemaining(
  endsAt: string | null,
  serverOffset: number = 0
): number {
  if (!endsAt) return 0;
  const endTime = new Date(endsAt).getTime();
  const now = Date.now() + serverOffset;
  return Math.max(0, Math.ceil((endTime - now) / 1000));
}

/**
 * Get the minimum bid increment based on current price tier
 */
export function getNextBidIncrement(currentBidLakhs: number): number {
  if (currentBidLakhs < 100) return 5; // Below 1 Cr: +5 Lakh
  if (currentBidLakhs < 500) return 25; // 1-5 Cr: +25 Lakh
  if (currentBidLakhs < 1000) return 50; // 5-10 Cr: +50 Lakh
  return 100; // 10+ Cr: +1 Cr
}

/**
 * Format remaining seconds into mm:ss display
 */
export function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
