import { prisma } from '@penyzen/database';
import { ConflictError, NotFoundError } from '@penyzen/shared';
import { stripe } from '../stripe/stripeClient';

const CONNECT_REDIRECT_URL = process.env['STRIPE_CONNECT_REDIRECT_URL'] ?? '';
const API_URL = process.env['API_URL'] ?? '';

export async function createConnectAccount(cognitoId: string) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  if (user.stripeAccountId) {
    // Already has an account — return the onboarding link for it
    return getOnboardingLink(user.stripeAccountId);
  }

  // Create a Stripe Express account (simplest for organizers — Stripe handles the UI)
  const account = await stripe.accounts.create({
    type: 'express',
    email: user.email,
    metadata: { userId: user.id },
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
    settings: {
      payouts: {
        schedule: { interval: 'daily' },
        debit_negative_balances: true,
      },
    },
  });

  await prisma.user.update({
    where: { cognitoId },
    data: { stripeAccountId: account.id },
  });

  return getOnboardingLink(account.id);
}

async function getOnboardingLink(accountId: string) {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${API_URL}/v1/connect/onboard`,
    return_url: CONNECT_REDIRECT_URL,
    type: 'account_onboarding',
  });

  return { url: accountLink.url, expiresAt: accountLink.expires_at };
}

export async function getConnectStatus(cognitoId: string) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  if (!user.stripeAccountId) {
    return { connected: false, accountId: null, status: null };
  }

  const account = await stripe.accounts.retrieve(user.stripeAccountId);

  return {
    connected: true,
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    requiresInformation: !account.charges_enabled || !account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
  };
}

export async function getDashboardLink(cognitoId: string) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');
  if (!user.stripeAccountId) {
    throw new ConflictError('You have not connected a Stripe account yet');
  }

  const loginLink = await stripe.accounts.createLoginLink(user.stripeAccountId);
  return { url: loginLink.url };
}
