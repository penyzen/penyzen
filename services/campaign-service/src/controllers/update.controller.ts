import { created, ok, validateBody } from '@penyzen/shared';
import type { RouteHandler } from '@penyzen/lambda-router';
import * as updateService from '../services/update.service';
import { CreateUpdateSchema } from '../schemas/update.schema';

export const createUpdate: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { campaignId } = ctx.pathParams;
  const input = validateBody(CreateUpdateSchema, ctx.getBody());
  const update = await updateService.createUpdate(cognitoId, campaignId!, input);
  return created(update);
};

export const listUpdates: RouteHandler = async (ctx) => {
  const { campaignId } = ctx.pathParams;
  const updates = await updateService.listUpdates(campaignId!);
  return ok(updates);
};
