import { created, ok, noContent, validateBody } from '@penyzen/shared';
import type { RouteHandler } from '@penyzen/lambda-router';
import * as milestoneService from '../services/milestone.service';
import { CreateMilestoneSchema, UpdateMilestoneSchema } from '../schemas/milestone.schema';

export const createMilestone: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { campaignId } = ctx.pathParams;
  const input = validateBody(CreateMilestoneSchema, ctx.getBody());
  const milestone = await milestoneService.createMilestone(cognitoId, campaignId!, input);
  return created(milestone);
};

export const listMilestones: RouteHandler = async (ctx) => {
  const { campaignId } = ctx.pathParams;
  const milestones = await milestoneService.listMilestones(campaignId!);
  return ok(milestones);
};

export const updateMilestone: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { campaignId, milestoneId } = ctx.pathParams;
  const input = validateBody(UpdateMilestoneSchema, ctx.getBody());
  const milestone = await milestoneService.updateMilestone(cognitoId, campaignId!, milestoneId!, input);
  return ok(milestone);
};

export const deleteMilestone: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { campaignId, milestoneId } = ctx.pathParams;
  await milestoneService.deleteMilestone(cognitoId, campaignId!, milestoneId!);
  return noContent();
};
