import { created, ok, noContent, validate, validateBody } from '@penyzen/shared';
import type { RouteHandler } from '@penyzen/lambda-router';
import * as campaignService from '../services/campaign.service';
import * as s3Service from '../services/s3.service';
import {
  CreateCampaignSchema,
  UpdateCampaignSchema,
  ListCampaignsQuerySchema,
} from '../schemas/campaign.schema';
import { z } from 'zod';
import { ValidationError } from '@penyzen/shared';

export const createCampaign: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const input = validateBody(CreateCampaignSchema, ctx.getBody());
  const campaign = await campaignService.createCampaign(cognitoId, input);
  return created(campaign);
};

export const listCampaigns: RouteHandler = async (ctx) => {
  const query = validate(ListCampaignsQuerySchema, ctx.queryParams);
  const result = await campaignService.listCampaigns(query);
  return ok(result);
};

export const getCampaign: RouteHandler = async (ctx) => {
  const { campaignId } = ctx.pathParams;
  const campaign = await campaignService.getCampaign(campaignId!);
  return ok(campaign);
};

export const updateCampaign: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { campaignId } = ctx.pathParams;
  const input = validateBody(UpdateCampaignSchema, ctx.getBody());
  const campaign = await campaignService.updateCampaign(cognitoId, campaignId!, input);
  return ok(campaign);
};

export const deleteCampaign: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { campaignId } = ctx.pathParams;
  await campaignService.deleteCampaign(cognitoId, campaignId!);
  return noContent();
};

export const publishCampaign: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { campaignId } = ctx.pathParams;
  const campaign = await campaignService.publishCampaign(cognitoId, campaignId!);
  return ok(campaign);
};

export const unpublishCampaign: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { campaignId } = ctx.pathParams;
  const campaign = await campaignService.unpublishCampaign(cognitoId, campaignId!);
  return ok(campaign);
};

export const listMyCampaigns: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const campaigns = await campaignService.listMyCampaigns(cognitoId);
  return ok(campaigns);
};

const MediaUploadSchema = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
});

export const getMediaUploadUrl: RouteHandler = async (ctx) => {
  const { campaignId } = ctx.pathParams;
  const { filename, contentType } = validateBody(MediaUploadSchema, ctx.getBody());

  if (!s3Service.isAllowedMediaType(contentType)) {
    throw new ValidationError('Invalid content type', { contentType: ['Not an allowed media type'] });
  }

  const result = await s3Service.generateMediaUploadUrl(campaignId!, filename, contentType);
  return ok(result);
};
