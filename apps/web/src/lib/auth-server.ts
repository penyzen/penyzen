import { cookies } from 'next/headers';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth/server';
import { runWithAmplifyServerContext } from './amplify-server';

export interface ServerUser {
  userId: string;
  username: string;
  email: string;
  fullName: string | null;
}

/**
 * Returns the authenticated Cognito user from the request cookies, or null
 * if there is no valid session. Safe to call from RSC, route handlers, and middleware.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  try {
    return await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: async (contextSpec) => {
        const [user, session] = await Promise.all([
          getCurrentUser(contextSpec),
          fetchAuthSession(contextSpec),
        ]);
        const claims = session.tokens?.idToken?.payload ?? {};
        return {
          userId: user.userId,
          username: user.username,
          email: typeof claims['email'] === 'string' ? claims['email'] : user.username,
          fullName: typeof claims['name'] === 'string' ? claims['name'] : null,
        };
      },
    });
  } catch {
    return null;
  }
}

/**
 * Returns the auth ID token, or null when not signed in.
 * Used to forward the token to the backend API in server-side fetches.
 */
export async function getServerIdToken(): Promise<string | null> {
  try {
    return await runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: async (contextSpec) => {
        const session = await fetchAuthSession(contextSpec);
        return session.tokens?.idToken?.toString() ?? null;
      },
    });
  } catch {
    return null;
  }
}
