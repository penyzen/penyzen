import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from 'aws-lambda';
import { Router } from '@penyzen/lambda-router';
import { logger } from '@penyzen/shared';
import { registerRoutes } from './routes';

const router = new Router();
registerRoutes(router);

export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context,
): Promise<APIGatewayProxyResultV2> => {
  context.callbackWaitsForEmptyEventLoop = false;

  logger.info(
    { requestId: context.awsRequestId, method: event.requestContext.http.method, path: event.rawPath },
    'campaign-service request',
  );

  return router.handle(event);
};
