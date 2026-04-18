import { ok, created } from '@penyzen/shared';
import type { RouteHandler } from '@penyzen/lambda-router';
import * as kycService from '../services/kyc.service';

export const startKyc: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const result = await kycService.startKyc(cognitoId);
  return created(result);
};

export const getKycStatus: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const result = await kycService.getKycStatus(cognitoId);
  return ok(result);
};

/**
 * Stripe Identity webhook — no auth (verified by Stripe signature instead).
 * Signature verification happens in the middleware layer.
 */
export const kycWebhook: RouteHandler = async (ctx) => {
  const body = ctx.getBody();
  if (!body) return ok({ received: true });

  const event = JSON.parse(body) as { type: string; data: { object: { id: string; status: string; last_error?: { reason?: string } } } };

  if (event.type === 'identity.verification_session.verified') {
    await kycService.handleKycWebhookEvent(event.data.object.id, true);
  } else if (event.type === 'identity.verification_session.requires_input') {
    const reason = event.data.object.last_error?.reason;
    await kycService.handleKycWebhookEvent(event.data.object.id, false, reason);
  }

  return ok({ received: true });
};
