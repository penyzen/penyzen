import { created, ok, validateBody } from '@penyzen/shared';
import type { RouteHandler } from '@penyzen/lambda-router';
import * as authService from '../services/auth.service';
import {
  ConfirmRegistrationSchema,
  ForgotPasswordSchema,
  LoginSchema,
  RefreshTokenSchema,
  RegisterSchema,
  ResetPasswordSchema,
} from '../schemas/auth.schema';

export const register: RouteHandler = async (ctx) => {
  const input = validateBody(RegisterSchema, ctx.getBody());
  const result = await authService.register(input);
  return created(result);
};

export const confirmRegistration: RouteHandler = async (ctx) => {
  const input = validateBody(ConfirmRegistrationSchema, ctx.getBody());
  const result = await authService.confirmRegistration(input);
  return ok(result);
};

export const login: RouteHandler = async (ctx) => {
  const input = validateBody(LoginSchema, ctx.getBody());
  const result = await authService.login(input);
  return ok(result);
};

export const refreshToken: RouteHandler = async (ctx) => {
  const input = validateBody(RefreshTokenSchema, ctx.getBody());
  const result = await authService.refreshToken(input);
  return ok(result);
};

export const forgotPassword: RouteHandler = async (ctx) => {
  const input = validateBody(ForgotPasswordSchema, ctx.getBody());
  const result = await authService.forgotPassword(input);
  return ok(result);
};

export const resetPassword: RouteHandler = async (ctx) => {
  const input = validateBody(ResetPasswordSchema, ctx.getBody());
  const result = await authService.resetPassword(input);
  return ok(result);
};

export const logout: RouteHandler = async (ctx) => {
  // The Authorization header value is the access token
  const authHeader = ctx.event.headers['authorization'] ?? '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  const result = await authService.logout(accessToken);
  return ok(result);
};
