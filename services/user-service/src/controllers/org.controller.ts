import { created, ok, noContent, validateBody } from '@penyzen/shared';
import type { RouteHandler } from '@penyzen/lambda-router';
import * as orgService from '../services/org.service';
import { CreateOrgSchema, UpdateOrgSchema, AddMemberSchema } from '../schemas/org.schema';

export const createOrg: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const input = validateBody(CreateOrgSchema, ctx.getBody());
  const org = await orgService.createOrg(cognitoId, input);
  return created(org);
};

export const getOrg: RouteHandler = async (ctx) => {
  const { orgId } = ctx.pathParams;
  const org = await orgService.getOrg(orgId!);
  return ok(org);
};

export const updateOrg: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { orgId } = ctx.pathParams;
  const input = validateBody(UpdateOrgSchema, ctx.getBody());
  const org = await orgService.updateOrg(cognitoId, orgId!, input);
  return ok(org);
};

export const addMember: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { orgId } = ctx.pathParams;
  const input = validateBody(AddMemberSchema, ctx.getBody());
  const member = await orgService.addMember(cognitoId, orgId!, input);
  return created(member);
};

export const removeMember: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const { orgId, userId } = ctx.pathParams;
  await orgService.removeMember(cognitoId, orgId!, userId!);
  return noContent();
};

export const listMyOrgs: RouteHandler = async (ctx) => {
  const cognitoId = ctx.getUserId();
  const orgs = await orgService.listMyOrgs(cognitoId);
  return ok(orgs);
};
