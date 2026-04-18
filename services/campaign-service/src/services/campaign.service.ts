import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { prisma } from '@penyzen/database';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  paginate,
  type NotificationEvent,
} from '@penyzen/shared';
import type { CreateCampaignInput, UpdateCampaignInput, ListCampaignsQuery } from '../schemas/campaign.schema';

const sqs = new SQSClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
const NOTIFICATION_QUEUE_URL = process.env['SQS_NOTIFICATION_QUEUE_URL'] ?? '';

function slugify(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
  // Append first 8 chars of UUID to guarantee uniqueness
  return `${base}-${id.slice(0, 8)}`;
}

async function requireOwner(cognitoId: string, campaignId: string) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new NotFoundError('Campaign', campaignId);

  if (campaign.organizerId !== user.id) {
    throw new ForbiddenError('You are not the organizer of this campaign');
  }

  return { user, campaign };
}

export async function createCampaign(cognitoId: string, input: CreateCampaignInput) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  // If an organizationId is provided, verify the user is a member
  if (input.organizationId) {
    const membership = await prisma.orgMember.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: input.organizationId } },
    });
    if (!membership) throw new ForbiddenError('You are not a member of this organization');
  }

  // Create with a temporary slug; update after we have the ID
  const campaign = await prisma.campaign.create({
    data: {
      slug: `draft-${Date.now()}`,
      title: input.title,
      description: input.description,
      story: input.story,
      category: input.category as never,
      goalAmountCents: input.goalAmountCents,
      location: input.location,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      videoUrl: input.videoUrl,
      organizerId: user.id,
      organizationId: input.organizationId,
    },
  });

  // Update with deterministic slug
  const finalSlug = slugify(input.title, campaign.id);
  return prisma.campaign.update({
    where: { id: campaign.id },
    data: { slug: finalSlug },
    include: {
      organizer: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true } },
    },
  });
}

export async function listCampaigns(query: ListCampaignsQuery) {
  const { page, limit, category, search } = query;
  const skip = (page - 1) * limit;

  const where = {
    status: 'PUBLISHED' as const,
    ...(category && { category: category as never }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [campaigns, total] = await prisma.$transaction([
    prisma.campaign.findMany({
      where,
      skip,
      take: limit,
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        category: true,
        status: true,
        goalAmountCents: true,
        raisedAmountCents: true,
        donorCount: true,
        coverImageUrl: true,
        location: true,
        endsAt: true,
        publishedAt: true,
        createdAt: true,
        organizer: { select: { id: true, name: true, avatarUrl: true } },
        organization: { select: { id: true, name: true, isVerified: true } },
      },
    }),
    prisma.campaign.count({ where }),
  ]);

  return paginate(campaigns, total, page, limit);
}

export async function getCampaign(id: string) {
  // Try lookup by ID first, then by slug
  const campaign = await prisma.campaign.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      organizer: { select: { id: true, name: true, avatarUrl: true, kycStatus: true } },
      organization: { select: { id: true, name: true, slug: true, logoUrl: true, isVerified: true } },
      milestones: { orderBy: { targetAmountCents: 'asc' } },
      updates: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!campaign) throw new NotFoundError('Campaign', id);
  return campaign;
}

export async function updateCampaign(
  cognitoId: string,
  campaignId: string,
  input: UpdateCampaignInput,
) {
  const { campaign } = await requireOwner(cognitoId, campaignId);

  if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') {
    throw new ForbiddenError('Cannot edit a completed or cancelled campaign');
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.story !== undefined && { story: input.story }),
      ...(input.goalAmountCents !== undefined && { goalAmountCents: input.goalAmountCents }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.endsAt !== undefined && { endsAt: input.endsAt ? new Date(input.endsAt) : null }),
      ...(input.coverImageUrl !== undefined && { coverImageUrl: input.coverImageUrl }),
      ...(input.videoUrl !== undefined && { videoUrl: input.videoUrl }),
    },
  });
}

export async function publishCampaign(cognitoId: string, campaignId: string) {
  const { campaign, user } = await requireOwner(cognitoId, campaignId);

  if (campaign.status === 'PUBLISHED') throw new ConflictError('Campaign is already published');
  if (campaign.status === 'CANCELLED') throw new ForbiddenError('Cannot publish a cancelled campaign');

  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });

  // Notify organizer
  const event: NotificationEvent = {
    type: 'CAMPAIGN_CREATED',
    payload: {
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      organizerEmail: user.email,
      organizerName: user.name,
    },
  };
  await sqs.send(
    new SendMessageCommand({ QueueUrl: NOTIFICATION_QUEUE_URL, MessageBody: JSON.stringify(event) }),
  );

  return updated;
}

export async function unpublishCampaign(cognitoId: string, campaignId: string) {
  await requireOwner(cognitoId, campaignId);
  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'PAUSED' },
  });
}

export async function deleteCampaign(cognitoId: string, campaignId: string) {
  const { campaign } = await requireOwner(cognitoId, campaignId);

  if (campaign.status !== 'DRAFT') {
    throw new ForbiddenError('Only draft campaigns can be deleted. Pause a published campaign instead.');
  }

  await prisma.campaign.delete({ where: { id: campaignId } });
  return { deleted: true };
}

export async function listMyCampaigns(cognitoId: string) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');

  return prisma.campaign.findMany({
    where: { organizerId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      goalAmountCents: true,
      raisedAmountCents: true,
      donorCount: true,
      coverImageUrl: true,
      publishedAt: true,
      createdAt: true,
    },
  });
}
