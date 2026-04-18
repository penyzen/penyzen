import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

/** Parsed path parameters from route pattern matching */
export type PathParams = Record<string, string>;

/** Parsed query string parameters */
export type QueryParams = Record<string, string | string[] | undefined>;

/** The context object passed to every route handler */
export interface RouterContext {
  event: APIGatewayProxyEventV2;
  pathParams: PathParams;
  queryParams: QueryParams;
  /** Raw request body (may be base64 encoded — use getBody() helper) */
  rawBody: string | null;
  /** Cognito JWT claims injected by API Gateway authorizer */
  claims: Record<string, string> | null;
  /** Convenience: get the authenticated user's Cognito sub (throws if not authed) */
  getUserId(): string;
  /** Convenience: get parsed body as string (handles base64) */
  getBody(): string | null;
}

export type RouteHandler = (ctx: RouterContext) => Promise<APIGatewayProxyResultV2>;

export type MiddlewareFn = (
  ctx: RouterContext,
  next: () => Promise<APIGatewayProxyResultV2>,
) => Promise<APIGatewayProxyResultV2>;

export interface Route {
  method: string;
  pattern: string;
  handler: RouteHandler;
  middlewares: MiddlewareFn[];
}
