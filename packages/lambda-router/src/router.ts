import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { errorResponse } from '@penyzen/shared';
import { UnauthorizedError } from '@penyzen/shared';
import type { Route, RouteHandler, MiddlewareFn, RouterContext, PathParams, QueryParams } from './types';

/**
 * Lightweight internal router for Lambda functions.
 *
 * Matches incoming API Gateway HTTP API v2 events to registered routes.
 * Supports path parameters ({id}), method routing, and per-route middleware.
 *
 * Usage:
 *   const router = new Router();
 *   router.get('/campaigns', listCampaigns);
 *   router.post('/campaigns', [requireAuth], createCampaign);
 *   export const handler = (event, ctx) => router.handle(event);
 */
export class Router {
  private routes: Route[] = [];
  private globalMiddlewares: MiddlewareFn[] = [];

  /** Register a global middleware applied to every route */
  use(middleware: MiddlewareFn): this {
    this.globalMiddlewares.push(middleware);
    return this;
  }

  get(pattern: string, ...args: [...MiddlewareFn[], RouteHandler]): this {
    return this.register('GET', pattern, args);
  }

  post(pattern: string, ...args: [...MiddlewareFn[], RouteHandler]): this {
    return this.register('POST', pattern, args);
  }

  put(pattern: string, ...args: [...MiddlewareFn[], RouteHandler]): this {
    return this.register('PUT', pattern, args);
  }

  patch(pattern: string, ...args: [...MiddlewareFn[], RouteHandler]): this {
    return this.register('PATCH', pattern, args);
  }

  delete(pattern: string, ...args: [...MiddlewareFn[], RouteHandler]): this {
    return this.register('DELETE', pattern, args);
  }

  options(pattern: string, handler: RouteHandler): this {
    return this.register('OPTIONS', pattern, [handler]);
  }

  private register(method: string, pattern: string, args: (MiddlewareFn | RouteHandler)[]): this {
    const handler = args[args.length - 1] as RouteHandler;
    const middlewares = args.slice(0, -1) as MiddlewareFn[];
    this.routes.push({ method, pattern, handler, middlewares });
    return this;
  }

  async handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
    // Handle preflight CORS
    if (event.requestContext.http.method === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: {
          'Access-Control-Allow-Origin': process.env['APP_URL'] ?? '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          'Access-Control-Max-Age': '86400',
        },
        body: '',
      };
    }

    const method = event.requestContext.http.method.toUpperCase();
    const path = event.rawPath.replace(/\/$/, '') || '/'; // strip trailing slash

    try {
      for (const route of this.routes) {
        const match = this.matchRoute(route.method, route.pattern, method, path);
        if (!match) continue;

        const ctx = this.buildContext(event, match.pathParams);
        const allMiddlewares = [...this.globalMiddlewares, ...route.middlewares];

        return await this.runMiddlewareChain(allMiddlewares, ctx, () =>
          route.handler(ctx),
        );
      }

      return errorResponse({ statusCode: 404, code: 'NOT_FOUND', message: `Route ${method} ${path} not found` });
    } catch (err) {
      return errorResponse(err);
    }
  }

  private matchRoute(
    routeMethod: string,
    routePattern: string,
    reqMethod: string,
    reqPath: string,
  ): { pathParams: PathParams } | null {
    if (routeMethod !== reqMethod) return null;

    const patternParts = routePattern.split('/').filter(Boolean);
    const pathParts = reqPath.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) return null;

    const pathParams: PathParams = {};
    for (let i = 0; i < patternParts.length; i++) {
      const pPart = patternParts[i]!;
      const rPart = pathParts[i]!;
      if (pPart.startsWith('{') && pPart.endsWith('}')) {
        pathParams[pPart.slice(1, -1)] = decodeURIComponent(rPart);
      } else if (pPart !== rPart) {
        return null;
      }
    }

    return { pathParams };
  }

  private buildContext(event: APIGatewayProxyEventV2, pathParams: PathParams): RouterContext {
    const requestContext = event.requestContext as unknown as Record<string, unknown>;
    const claims =
      requestContext.authorizer != null
        ? (requestContext.authorizer as { jwt?: { claims?: Record<string, string> } })?.jwt?.claims ?? null
        : null;

    const queryParams: QueryParams = {};
    if (event.queryStringParameters) {
      for (const [k, v] of Object.entries(event.queryStringParameters)) {
        queryParams[k] = v;
      }
    }

    return {
      event,
      pathParams,
      queryParams,
      rawBody: event.body ?? null,
      claims,
      getUserId(): string {
        const sub = claims?.['sub'];
        if (!sub) throw new UnauthorizedError();
        return sub;
      },
      getBody(): string | null {
        if (!event.body) return null;
        if (event.isBase64Encoded) {
          return Buffer.from(event.body, 'base64').toString('utf-8');
        }
        return event.body;
      },
    };
  }

  private async runMiddlewareChain(
    middlewares: MiddlewareFn[],
    ctx: RouterContext,
    finalHandler: () => Promise<APIGatewayProxyResultV2>,
  ): Promise<APIGatewayProxyResultV2> {
    let index = 0;

    const next = async (): Promise<APIGatewayProxyResultV2> => {
      if (index < middlewares.length) {
        const middleware = middlewares[index++]!;
        return middleware(ctx, next);
      }
      return finalHandler();
    };

    return next();
  }
}
