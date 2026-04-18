import { prisma } from '@penyzen/database';
import { ForbiddenError, NotFoundError } from '@penyzen/shared';
import { MAX_MILESTONES_PER_CAMPAIGN } from '@penyzen/shared';
import type { CreateMilestoneInput, UpdateMilestoneInput } from '../schemas/milestone.schema';

async function requireCampaignOwner(cognitoId: string, campaignId: string) {
  const user = await prisma.user.findUnique({ where: { cognitoId } });
  if (!user) throw new NotFoundError('User');
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new NotFoundError('Campaign', campaignId);
  if (campaign.organizerId !== user.id) throw new ForbiddenError('Not the campaign organizer');
  return { user, campaign };
}

export async function createMilestone(
  cognitoId: string,
  campaignId: string,
  input: CreateMilestoneInput,
) {
  await requireCampaignOwner(cognitoId, campaignId);

  const count = await prisma.milestone.count({ where: { campaignId } });
  if (count >= MAX_MILESTONES_PER_CAMPAIGN) {
    throw new ForbiddenError(`Maximum of ${MAX_MILESTONES_PER_CAMPAIGN} milestones per campaign`);
  }

  return prisma.milestone.create({
    data: {
      campaignId,
      title: input.title,
      description: input.description,
      targetAmountCents: input.targetAmountCents,
    },
  });
}

export async function listMilestones(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new NotFoundError('Campaign', campaignId);

  return prisma.milestone.findMany({
    where: { campaignId },
    orderBy: { targetAmountCents: 'asc' },
  });
}

export async function updateMilestone(
  cognitoId: string,
  campaignId: string,
  milestoneId: string,
  input: UpdateMilestoneInput,
) {
  await requireCampaignOwner(cognitoId, campaignId);

  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, campaignId } });
  if (!milestone) throw new NotFoundError('Milestone', milestoneId);

  return prisma.milestone.update({ where: { id: milestoneId }, data: input });
}

export async function deleteMilestone(
  cognitoId: string,
  campaignId: string,
  milestoneId: string,
) {
  await requireCampaignOwner(cognitoId, campaignId);

  const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, campaignId } });
  if (!milestone) throw new NotFoundError('Milestone', milestoneId);

  await prisma.milestone.delete({ where: { id: milestoneId } });
  return { deleted: true };
}
