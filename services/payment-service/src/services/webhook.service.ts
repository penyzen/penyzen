import type Stripe from 'stripe';
import { stripe, STRIPE_WEBHOOK_SECRET } from '../stripe/stripeClient';
import { handlePaymentSucceeded, handlePaymentFailed } from './donation.service';
import { logger } from '@penyzen/shared';
import { AppError } from '@penyzen/shared';

/**
 * Verifies the Stripe webhook signature and dispatches to the correct handler.
 *
 * IMPORTANT: This function must receive the RAW request body bytes, not the
 * parsed JSON. Stripe's signature is computed over the raw bytes.
 */
export async function processStripeWebhook(rawBody: string, signature: string): Promise<void> {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err }, 'Stripe webhook signature verification failed');
    throw new AppError('Invalid webhook signature', 400, 'WEBHOOK_SIGNATURE_INVALID');
  }

  logger.info({ eventType: event.type, eventId: event.id }, 'stripe webhook received');

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      await handlePaymentSucceeded(pi.id);
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      await handlePaymentFailed(pi.id);
      break;
    }

    case 'account.updated': {
      // Stripe Connect account status changed — log for now, extend later
      const account = event.data.object as Stripe.Account;
      logger.info({ accountId: account.id, chargesEnabled: account.charges_enabled }, 'connect account updated');
      break;
    }

    default:
      // Unhandled event types — acknowledged but not processed
      logger.debug({ eventType: event.type }, 'unhandled stripe event type');
  }
}
