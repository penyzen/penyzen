import Stripe from 'stripe';

// Stripe client singleton — reused across warm Lambda invocations
export const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', {
  apiVersion: '2024-06-20',
  // Disable Stripe telemetry to reduce Lambda cold start
  telemetry: false,
  // Set a per-request timeout — prevent Lambda timeouts from hanging Stripe calls
  timeout: 10000,
});

export const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'] ?? '';
