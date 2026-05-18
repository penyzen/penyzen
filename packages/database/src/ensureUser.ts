import { Prisma } from '@prisma/client';
import { logger } from '@penyzen/shared';
import { prisma } from './client';

/**
 * Lazily provisions a DB User row from JWT claims on the first
 * authenticated request.
 *
 * The web app registers users directly against Cognito (Amplify signUp),
 * which never calls the backend register endpoint that creates the DB
 * row. Without this, every authenticated write fails with
 * NotFoundError('User'). Idempotent and cheap (one upsert keyed by the
 * stable Cognito sub).
 */
export async function ensureUser(
  claims: Record<string, string> | null | undefined,
): Promise<void> {
  const cognitoId = claims?.['sub'];
  if (!cognitoId) return;

  const email = claims['email'];
  // email is a required, unique column. If the token has no email claim
  // we can't provision; let the downstream handler surface the error.
  if (!email) return;

  const name = claims['name'] ?? claims['cognito:username'] ?? email;

  try {
    await prisma.user.upsert({
      where: { cognitoId },
      update: {},
      create: { cognitoId, email, name },
    });
  } catch (err) {
    // Another account already owns this email under a different sub.
    // Don't hard-fail every authed request over it.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      logger.warn({ cognitoId, email }, 'ensureUser: email already linked to another account');
      return;
    }
    throw err;
  }
}
