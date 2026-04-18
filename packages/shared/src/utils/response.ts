import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { AppError } from '../errors/AppError';
import { ValidationError } from '../errors/ValidationError';
import { logger } from './logger';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env['APP_URL'] ?? '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

export function ok<T>(data: T, meta?: Record<string, unknown>, statusCode = 200): APIGatewayProxyResultV2 {
  const body: ApiSuccessResponse<T> = { success: true, data, ...(meta && { meta }) };
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export function created<T>(data: T): APIGatewayProxyResultV2 {
  return ok(data, undefined, 201);
}

export function noContent(): APIGatewayProxyResultV2 {
  return { statusCode: 204, headers: CORS_HEADERS, body: '' };
}

export function errorResponse(err: unknown): APIGatewayProxyResultV2 {
  if (err instanceof ValidationError) {
    const body: ApiErrorResponse = {
      success: false,
      error: { code: err.code, message: err.message, fields: err.fields },
    };
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify(body) };
  }

  if (err instanceof AppError) {
    const body: ApiErrorResponse = {
      success: false,
      error: { code: err.code, message: err.message },
    };
    return { statusCode: err.statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
  }

  // Unexpected error — log it and return 500
  logger.error({ err }, 'Unhandled error');
  const body: ApiErrorResponse = {
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  };
  return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify(body) };
}
