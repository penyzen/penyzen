import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { Router } from '@penyzen/lambda-router';
import { logger } from '@penyzen/shared';
import { registerRoutes } from './routes';

/**
 * user-service Lambda entry point.
 *
 * The Router instance is created OUTSIDE the handler function so it is
 * reused across warm Lambda invocations (no re-registration overhead).
 * The Prisma client connection is also held in the module scope via
 * @penyzen/database, giving us connection reuse across invocations.
 */
const router = new Router();
registerRoutes(router);

export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> => {
  // Setting this to false lets Lambda return the response immediately without
  // waiting for the event loop to drain. Critical for Prisma connection reuse.
  context.callbackWaitsForEmptyEventLoop = false;

  logger.info(
    { requestId: context.awsRequestId, method: event.requestContext.http.method, path: event.rawPath },
    'user-service request',
  );

  return router.handle(event);
};
