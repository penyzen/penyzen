import { UnauthorizedError } from '@penyzen/shared';
import type { MiddlewareFn } from '@penyzen/lambda-router';

export const requireAuth: MiddlewareFn = async (ctx, next) => {
  if (!ctx.claims?.['sub']) {
    throw new UnauthorizedError('A valid access token is required');
  }
  return next();
};
