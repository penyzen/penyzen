import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { prisma } from '@penyzen/database';
import {
  ForbiddenError,
  NotFoundError,
  calculatePlatformFee,
  calculateNetAmount,
  type NotificationEvent,
} from '@penyzen/shared';
import { stripe } from '../stripe/stripeClient';
import type { CreateDonationInput } from '../schemas/donation.schema';

const sqs = new SQSClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
const NOTIFICATION_QUEUE_URL = process.env['SQS_NOTIFICATION_QUEUE_URL'] ?? '';
const PLATFORM_FEE_PERCENT = parseFloat(process.env['PLATFORM_FEE_PERCENT'] ?? '2.5');

export async function createDonation(cognitoId: string, input: CreateDonationInput) {
  const donor = await prisma.user.findUnique({ where: { cognitoId } });
  if (!donor) throw new NotFoundError('User');

  const campaign = await prisma.campaign.findUnique({
    where: { id: input.campaignId },
    include: { organizer: { select: { stripeAccountId: true, email: true, name: true } } },
  });
  if (!campaign) throw new NotFoundError('Campaign', input.campaignId);
  if (campaign.status !== 'PUBLISHED') {
    throw new ForbiddenError('This campaign is not currently accepting donations');
  }
  if (!campaign.organizer.stripeAccountId) {
    throw new ForbiddenError('The organizer has not connected a payout account yet');
  }

  const feeCents = calculatePlatformFee(input.amountCents);
  const netAmountCents = calculateNetAmount(input.amountCents);

  // Create a Stripe PaymentIntent using Stripe Connect
  // - The charge goes to the organizer's connected account
  // - The platform fee is collected by our platform account (via application_fee_amount)
  const paymentIntent = await stripe.paymentIntents.create({
    amount: input.amountCents,
    currency: 'usd',
    // Route payment to the organizer's Express account
    transfer_data: {
      destination: campaign.organizer.stripeAccountId,
    },
    // Platform takes its fee from the transfer
    application_fee_amount: feeCents,
    metadata: {
      campaignId: campaign.id,
      donorId: donor.id,
      isAnonymous: String(input.isAnonymous),
    },
    // Idempotency is handled by PaymentIntent creation — not setting idempotency key
    // here for simplicity, but should add one in production using donationId
  });

  // Create the Donation record in PENDING state
  // It will be updated to SUCCEEDED by the Stripe webhook (payment_intent.succeeded)
  const donation = await prisma.donation.create({
    data: {
      campaignId: campaign.id,
      donorId: donor.id,
      amountCents: input.amountCents,
      feeCents,
      netAmountCents,
      isAnonymous: input.isAnonymous,
      message: input.message,
      stripePaymentIntentId: paymentIntent.id,
      status: 'PENDING',
    },
  });

  return {
    donationId: donation.id,
    clientSecret: paymentIntent.client_secret,
    amountCents: input.amountCents,
    feeCents,
    netAmountCents,
  };
}

export async function getDonation(cognitoId: string, donationId: string) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  const donation = await prisma.donation.findFirst({
    where: { id: donationId, donorId: user.id },
    include: { campaign: { select: { id: true, title: true, slug: true } } },
  });
  if (!donation) throw new NotFoundError('Donation', donationId);
  return donation;
}

export async function listCampaignDonations(campaignId: string, page: number, limit: number) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new NotFoundError('Campaign', campaignId);

  const skip = (page - 1) * limit;

  const [donations, total] = await prisma.$transaction([
    prisma.donation.findMany({
      where: { campaignId, status: 'SUCCEEDED' },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amountCents: true,
        isAnonymous: true,
        message: true,
        createdAt: true,
        donor: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    }),
    prisma.donation.count({ where: { campaignId, status: 'SUCCEEDED' } }),
  ]);

  // Redact donor info for anonymous donations
  const redacted = donations.map((d) =>
    d.isAnonymous ? { ...d, donor: null } : d,
  );

  return { items: redacted, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function listMyDonations(cognitoId: string, page: number, limit: number) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  const skip = (page - 1) * limit;

  const [donations, total] = await prisma.$transaction([
    prisma.donation.findMany({
      where: { donorId: user.id },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { campaign: { select: { id: true, title: true, slug: true, coverImageUrl: true } } },
    }),
    prisma.donation.count({ where: { donorId: user.id } }),
  ]);

  return { items: donations, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Called by the webhook handler when Stripe confirms payment succeeded.
 * Updates the donation status and the campaign's raised amount + donor count.
 */
export async function handlePaymentSucceeded(paymentIntentId: string) {
  const donation = await prisma.donation.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: {
      donor: { select: { id: true, name: true, email: true } },
      campaign: {
        include: { organizer: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!donation) return; // Idempotency: already processed or unknown payment

  if (donation.status === 'SUCCEEDED') return; // Already handled

  // Transactionally update donation + campaign counters
  await prisma.$transaction([
    prisma.donation.update({
      where: { id: donation.id },
      data: { status: 'SUCCEEDED' },
    }),
    prisma.campaign.update({
      where: { id: donation.campaignId },
      data: {
        raisedAmountCents: { increment: donation.amountCents },
        donorCount: { increment: 1 },
      },
    }),
  ]);

  // Check milestone completions
  await checkMilestones(donation.campaignId);

  // Notify donor and organizer
  const donorEvent: NotificationEvent = {
    type: 'DONATION_RECEIVED',
    payload: {
      donationId: donation.id,
      campaignId: donation.campaignId,
      campaignTitle: donation.campaign.title,
      amountCents: donation.amountCents,
      donorName: donation.isAnonymous ? null : donation.donor.name,
      donorEmail: donation.donor.email,
      isAnonymous: donation.isAnonymous,
      message: donation.message,
      organizerEmail: donation.campaign.organizer.email,
      organizerName: donation.campaign.organizer.name,
    },
  };

  await sqs.send(
    new SendMessageCommand({ QueueUrl: NOTIFICATION_QUEUE_URL, MessageBody: JSON.stringify(donorEvent) }),
  );
}

export async function handlePaymentFailed(paymentIntentId: string) {
  await prisma.donation.updateMany({
    where: { stripePaymentIntentId: paymentIntentId },
    data: { status: 'FAILED' },
  });
}

async function checkMilestones(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { milestones: { where: { status: 'PENDING' } } },
  });
  if (!campaign) return;

  const reached = campaign.milestones.filter(
    (m) => m.targetAmountCents <= campaign.raisedAmountCents,
  );

  if (reached.length > 0) {
    await prisma.milestone.updateMany({
      where: { id: { in: reached.map((m) => m.id) } },
      data: { status: 'REACHED', reachedAt: new Date() },
    });
  }
}
