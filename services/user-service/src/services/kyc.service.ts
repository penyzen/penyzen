import Stripe from 'stripe';
import { prisma } from '@penyzen/database';
import { NotFoundError } from '@penyzen/shared';

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY'] ?? '', { apiVersion: '2024-06-20' });

export async function startKyc(cognitoId: string) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  // Create a Stripe Identity verification session
  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: { userId: user.id },
    options: {
      document: {
        require_matching_selfie: true,
      },
    },
    return_url: `${process.env['APP_URL'] ?? ''}/settings/kyc?status=complete`,
  });

  // Store the session ID so we can match the webhook later
  await prisma.user.update({
    where: { cognitoId },
    data: { stripeIdentitySessionId: session.id, kycStatus: 'PENDING' },
  });

  return {
    sessionId: session.id,
    clientSecret: session.client_secret,
    url: session.url,
  };
}

export async function getKycStatus(cognitoId: string) {
  const user = await prisma.user.findUnique({
    where: { cognitoId },
    select: { kycStatus: true, stripeIdentitySessionId: true },
  });
  if (!user) throw new NotFoundError('User');
  return { kycStatus: user.kycStatus };
}

/**
 * Called by the webhook handler when Stripe Identity sends a status update.
 */
export async function handleKycWebhookEvent(sessionId: string, verified: boolean, reason?: string) {
  const user = await prisma.user.findFirst({
    where: { stripeIdentitySessionId: sessionId },
  });
  if (!user) return; // Session not found in our system — ignore

  const newStatus = verified ? 'APPROVED' : 'REJECTED';

  await prisma.user.update({
    where: { id: user.id },
    data: { kycStatus: newStatus },
  });

  return { userId: user.id, newStatus, reason };
}
