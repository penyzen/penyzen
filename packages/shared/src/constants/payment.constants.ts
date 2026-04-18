/** Platform fee percentage taken from each donation (e.g. 2.5 = 2.5%) */
export const PLATFORM_FEE_PERCENT = parseFloat(process.env['PLATFORM_FEE_PERCENT'] ?? '2.5');

/** Stripe processing fee: 2.9% + $0.30 per transaction */
export const STRIPE_FEE_PERCENT = 2.9;
export const STRIPE_FEE_FIXED_CENTS = 30;

/** Minimum donation amount in cents */
export const MIN_DONATION_CENTS = 100; // $1.00

/** Maximum donation amount in cents */
export const MAX_DONATION_CENTS = 999_999_99; // ~$1M

/**
 * Calculates the platform fee in cents.
 * All money stays as integer cents — never floats.
 */
export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}

/**
 * Calculates the net amount after platform fee.
 */
export function calculateNetAmount(amountCents: number): number {
  return amountCents - calculatePlatformFee(amountCents);
}
