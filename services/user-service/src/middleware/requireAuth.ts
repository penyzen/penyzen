import { UnauthorizedError } from '@penyzen/shared';
import { ensureUser } from '@penyzen/database';
import type { MiddlewareFn } from '@penyzen/lambda-router';

/**
 * Verifies that the request carries a valid Cognito JWT.
 * API Gateway performs the cryptographic verification before the Lambda is invoked.
 * This middleware simply ensures the claims object was injected (i.e., auth passed),
 * then lazily provisions the DB User row (web users register direct to Cognito).
 */
export const requireAuth: MiddlewareFn = async (ctx, next) => {
  if (!ctx.claims?.['sub']) {
    throw new UnauthorizedError('A valid access token is required');
  }
  await ensureUser(ctx.claims);
  return next();
};
