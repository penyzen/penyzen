import { PrismaClient } from '@prisma/client';
import { logger } from '@penyzen/shared';

/**
 * Lambda connection pooling pattern:
 *
 * The PrismaClient instance is declared OUTSIDE the handler function.
 * Lambda reuses the execution context across warm invocations, so this
 * singleton persists across calls — avoiding a new connection on every request.
 *
 * With RDS Proxy in front of Aurora, this pattern is safe at scale.
 * RDS Proxy multiplexes these persistent connections across many Lambda instances.
 */

declare global {
  // Prevents multiple PrismaClient instances in development (hot-reload)
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
          ]
        : [{ emit: 'event', level: 'error' }],
  });

  if (process.env['NODE_ENV'] === 'development') {
    client.$on('query', (e) => {
      logger.debug({ query: e.query, duration: e.duration }, 'prisma:query');
    });
  }

  client.$on('error', (e) => {
    logger.error({ message: e.message }, 'prisma:error');
  });

  return client;
}

export const prisma: PrismaClient =
  process.env['NODE_ENV'] === 'development'
    ? (global.__prisma ??= createPrismaClient())
    : createPrismaClient();

export type { PrismaClient };
