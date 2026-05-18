import { UnauthorizedError } from '@penyzen/shared';
import { ensureUser } from '@penyzen/database';
import type { MiddlewareFn } from '@penyzen/lambda-router';

export const requireAuth: MiddlewareFn = async (ctx, next) => {
  if (!ctx.claims?.['sub']) {
    throw new UnauthorizedError('A valid access token is required');
  }
  // Lazily provision the DB User row (web users register direct to Cognito).
  await ensureUser(ctx.claims);
  return next();
};
