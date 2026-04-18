import { created, ok } from '@penyzen/shared';
import type { RouteHandler } from '@penyzen/lambda-router';
import * as connectService from '../services/connect.service';

export const onboard: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const result = await connectService.createConnectAccount(cognitoId);
  return created(result);
};

export const getStatus: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const status = await connectService.getConnectStatus(cognitoId);
  return ok(status);
};

export const getDashboardLink: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const link = await connectService.getDashboardLink(cognitoId);
  return ok(link);
};
