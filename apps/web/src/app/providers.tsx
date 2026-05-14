'use client';

import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { CookieStorage } from 'aws-amplify/utils';
import { amplifyConfig } from '@/lib/amplify-config';
import { type ReactNode } from 'react';

Amplify.configure(amplifyConfig, { ssr: true });

// Use cookies (not localStorage) so RSC and middleware can read the auth tokens.
cognitoUserPoolsTokenProvider.setKeyValueStorage(new CookieStorage());

export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
