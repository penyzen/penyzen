import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';

export const cognito = new CognitoIdentityProviderClient({
  region: process.env['COGNITO_REGION'] ?? process.env['AWS_REGION'] ?? 'us-east-1',
});

export const USER_POOL_ID = process.env['COGNITO_USER_POOL_ID'] ?? '';
export const APP_CLIENT_ID = process.env['COGNITO_APP_CLIENT_ID'] ?? '';
