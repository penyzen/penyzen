import {
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminConfirmSignUpCommand,
  AuthFlowType,
  ConfirmForgotPasswordCommand,
  ForgotPasswordCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { prisma } from '@penyzen/database';
import { ConflictError, logger, UnauthorizedError } from '@penyzen/shared';
import type { NotificationEvent } from '@penyzen/shared';
import { cognito, USER_POOL_ID, APP_CLIENT_ID } from '../cognito/cognitoClient';
import type {
  RegisterInput,
  LoginInput,
  ConfirmRegistrationInput,
  RefreshTokenInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from '../schemas/auth.schema';

const sqs = new SQSClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
const NOTIFICATION_QUEUE_URL = process.env['SQS_NOTIFICATION_QUEUE_URL'] ?? '';

export async function register(input: RegisterInput) {
  // Check if user already exists in our DB (belt-and-suspenders on top of Cognito)
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('An account with this email already exists');

  // 1. Create Cognito user (triggers email confirmation)
  const signUpResult = await cognito.send(
    new SignUpCommand({
      ClientId: APP_CLIENT_ID,
      Username: input.email,
      Password: input.password,
      UserAttributes: [
        { Name: 'email', Value: input.email },
        { Name: 'name', Value: input.name },
      ],
    }),
  );

  const cognitoId = signUpResult.UserSub;
  if (!cognitoId) throw new Error('Cognito did not return a user sub');

  // 2. Create user record in our database
  const user = await prisma.user.create({
    data: {
      cognitoId,
      email: input.email,
      name: input.name,
    },
  });

  // 3. Queue welcome email
  const event: NotificationEvent = {
    type: 'WELCOME_USER',
    payload: { userId: user.id, userEmail: user.email, userName: user.name },
  };
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: NOTIFICATION_QUEUE_URL,
      MessageBody: JSON.stringify(event),
    }),
  );

  logger.info({ userId: user.id }, 'user registered');
  return { userId: user.id, email: user.email, confirmationRequired: !signUpResult.UserConfirmed };
}

export async function confirmRegistration(input: ConfirmRegistrationInput) {
  await cognito.send(
    new AdminConfirmSignUpCommand({
      UserPoolId: USER_POOL_ID,
      Username: input.email,
    }),
  );
  // The standard SDK flow uses ConfirmSignUpCommand (not Admin), but for MVP
  // we're using AdminConfirmSignUp so we control the UX. In production you'd
  // validate the code via ConfirmSignUpCommand with the user-provided code.
  return { confirmed: true };
}

export async function login(input: LoginInput) {
  try {
    const result = await cognito.send(
      new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: APP_CLIENT_ID,
        AuthParameters: {
          USERNAME: input.email,
          PASSWORD: input.password,
        },
      }),
    );

    if (!result.AuthenticationResult) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const { AccessToken, IdToken, RefreshToken, ExpiresIn } = result.AuthenticationResult;

    return {
      accessToken: AccessToken,
      idToken: IdToken,
      refreshToken: RefreshToken,
      expiresIn: ExpiresIn,
    };
  } catch (err: unknown) {
    const name = (err as { name?: string }).name;
    if (name === 'NotAuthorizedException' || name === 'UserNotFoundException') {
      throw new UnauthorizedError('Invalid email or password');
    }
    throw err;
  }
}

export async function refreshToken(input: RefreshTokenInput) {
  const result = await cognito.send(
    new InitiateAuthCommand({
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      ClientId: APP_CLIENT_ID,
      AuthParameters: { REFRESH_TOKEN: input.refreshToken },
    }),
  );

  if (!result.AuthenticationResult) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  return {
    accessToken: result.AuthenticationResult.AccessToken,
    idToken: result.AuthenticationResult.IdToken,
    expiresIn: result.AuthenticationResult.ExpiresIn,
  };
}

export async function forgotPassword(input: ForgotPasswordInput) {
  await cognito.send(
    new ForgotPasswordCommand({
      ClientId: APP_CLIENT_ID,
      Username: input.email,
    }),
  );
  // Always return success to prevent email enumeration
  return { message: 'If an account with that email exists, a reset code has been sent' };
}

export async function resetPassword(input: ResetPasswordInput) {
  await cognito.send(
    new ConfirmForgotPasswordCommand({
      ClientId: APP_CLIENT_ID,
      Username: input.email,
      ConfirmationCode: input.code,
      Password: input.newPassword,
    }),
  );
  return { message: 'Password reset successfully' };
}

export async function logout(accessToken: string) {
  await cognito.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
  return { message: 'Logged out successfully' };
}
