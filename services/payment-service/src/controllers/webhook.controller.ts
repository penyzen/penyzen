import { ok } from '@penyzen/shared';
import { AppError } from '@penyzen/shared';
import type { RouteHandler } from '@penyzen/lambda-router';
import { processStripeWebhook } from '../services/webhook.service';

export const stripeWebhook: RouteHandler = async (ctx) => {
  const signature = ctx.event.headers['stripe-signature'];
  if (!signature) {
    throw new AppError('Missing Stripe-Signature header', 400, 'MISSING_SIGNATURE');
  }

  // The raw body is required for Stripe signature verification.
  // API Gateway HTTP API passes the body as-is (not JSON-parsed) when
  // the Content-Type is application/json and no body mapping template is set.
  const rawBody = ctx.getBody();
  if (!rawBody) {
    throw new AppError('Empty webhook body', 400, 'EMPTY_BODY');
  }

  await processStripeWebhook(rawBody, signature);

  // Always return 200 to Stripe immediately — failures are logged internally
  return ok({ received: true });
};
