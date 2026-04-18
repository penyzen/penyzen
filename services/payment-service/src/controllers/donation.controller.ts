import { created, ok, validate, validateBody } from '@penyzen/shared';
import type { RouteHandler } from '@penyzen/lambda-router';
import * as donationService from '../services/donation.service';
import { CreateDonationSchema } from '../schemas/donation.schema';
import { z } from 'zod';

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createDonation: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const input = validateBody(CreateDonationSchema, ctx.getBody());
  const result = await donationService.createDonation(cognitoId, input);
  return created(result);
};

export const getDonation: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { donationId } = ctx.pathParams;
  const donation = await donationService.getDonation(cognitoId, donationId!);
  return ok(donation);
};

export const listCampaignDonations: RouteHandler = async (ctx) => {
  const { campaignId } = ctx.pathParams;
  const { page, limit } = validate(PaginationSchema, ctx.queryParams);
  const result = await donationService.listCampaignDonations(campaignId!, page, limit);
  return ok(result);
};

export const listMyDonations: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { page, limit } = validate(PaginationSchema, ctx.queryParams);
  const result = await donationService.listMyDonations(cognitoId, page, limit);
  return ok(result);
};
