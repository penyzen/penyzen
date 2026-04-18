import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { prisma } from '@penyzen/database';
import { ForbiddenError, NotFoundError, type NotificationEvent } from '@penyzen/shared';
import type { CreateUpdateInput } from '../schemas/update.schema';

const sqs = new SQSClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
const NOTIFICATION_QUEUE_URL = process.env['SQS_NOTIFICATION_QUEUE_URL'] ?? '';

export async function createUpdate(
  cognitoId: string,
  campaignId: string,
  input: CreateUpdateInput,
) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new NotFoundError('Campaign', campaignId);
  if (campaign.organizerId !== user.id) throw new ForbiddenError('Not the campaign organizer');

  const update = await prisma.campaignUpdate.create({
    data: { campaignId, title: input.title, body: input.body },
  });

  // Fetch all donors' emails to notify them
  const donors = await prisma.donation.findMany({
    where: { campaignId, status: 'SUCCEEDED' },
    select: { donor: { select: { email: true } } },
    distinct: ['donorId'],
  });

  const donorEmails = donors.map((d) => d.donor.email);

  if (donorEmails.length > 0) {
    const event: NotificationEvent = {
      type: 'CAMPAIGN_UPDATE_POSTED',
      payload: {
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        updateTitle: input.title,
        updateBody: input.body,
        donorEmails,
      },
    };
    await sqs.send(
      new SendMessageCommand({ QueueUrl: NOTIFICATION_QUEUE_URL, MessageBody: JSON.stringify(event) }),
    );
  }

  return update;
}

export async function listUpdates(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new NotFoundError('Campaign', campaignId);

  return prisma.campaignUpdate.findMany({
    where: { campaignId },
    orderBy: { createdAt: 'desc' },
  });
}
