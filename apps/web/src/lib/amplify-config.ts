import type { ResourcesConfig } from 'aws-amplify';

export const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env['NEXT_PUBLIC_COGNITO_USER_POOL_ID']!,
      userPoolClientId: process.env['NEXT_PUBLIC_COGNITO_APP_CLIENT_ID']!,
      signUpVerificationMethod: 'code',
      loginWith: { email: true },
    },
  },
};
