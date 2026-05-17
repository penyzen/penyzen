import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  envName: 'dev' | 'prod';
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `penyzen-${props.envName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true, username: false },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: false },
        fullname: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: cdk.Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // Dev uses Cognito's built-in email sender (no SES setup, ~50/day,
      // works immediately). Production must switch back to SES with a
      // verified penyzen.com domain identity out of the SES sandbox
      // (see deployment-log-2026-05-13.md §7 — Option B / pre-prod gate).
      email: cognito.UserPoolEmail.withCognito('support@penyzen.com'),
      userVerification: {
        emailSubject: 'Verify your Penyzen account',
        emailBody: 'Your verification code is {####}. It expires in 24 hours.',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      deletionProtection: props.envName === 'prod',
      removalPolicy: props.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // App client (public — no client secret, used by SPA)
    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: `penyzen-web-${props.envName}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: false,
        adminUserPassword: false,
      },
      preventUserExistenceErrors: true, // Prevents email enumeration
      accessTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      idTokenValidity: cdk.Duration.hours(1),
      enableTokenRevocation: true,
      generateSecret: false,
    });

    this.userPoolId = this.userPool.userPoolId;
    this.userPoolClientId = this.userPoolClient.userPoolClientId;

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `penyzen-user-pool-id-${props.envName}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `penyzen-user-pool-client-id-${props.envName}`,
    });
  }
}
