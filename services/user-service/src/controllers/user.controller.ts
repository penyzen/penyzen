import { ok, validateBody } from '@penyzen/shared';
import type { RouteHandler } from '@penyzen/lambda-router';
import * as userService from '../services/user.service';
import { UpdateUserSchema } from '../schemas/user.schema';

export const getMe: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const user = await userService.getUserByCognitoId(cognitoId);
  return ok(user);
};

export const updateMe: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const input = validateBody(UpdateUserSchema, ctx.getBody());
  const user = await userService.updateUser(cognitoId, input);
  return ok(user);
};

export const getUser: RouteHandler = async (ctx) => {
  const { userId } = ctx.pathParams;
  const user = await userService.getUserById(userId!);
  return ok(user);
};
