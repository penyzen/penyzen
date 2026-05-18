import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { PenyzenLambda } from '../constructs/lambda-function';
import * as path from 'path';

export interface ApiStackProps extends cdk.StackProps {
  envName: 'dev' | 'prod';
  vpc: ec2.IVpc;
  lambdaSg: ec2.ISecurityGroup;
  dbSecret: secretsmanager.ISecret;
  proxyEndpoint: string;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  notificationQueue: sqs.Queue;
  mediaBucket: s3.Bucket;
  receiptsBucket: s3.Bucket;
  cloudfrontDomain: string;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const serviceRoot = path.join(__dirname, '../../../services');

    // Prisma client + ARM64 query engine, shared across all DB-backed services
    const prismaLayer = new lambda.LayerVersion(this, 'PrismaLayer', {
      layerVersionName: `penyzen-prisma-${props.envName}`,
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda-layers/prisma')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      compatibleArchitectures: [lambda.Architecture.ARM_64],
      description: '@prisma/client + linux-arm64-openssl-3.0.x query engine',
    });

    // Construct Prisma-compatible DATABASE_URL pointing at the RDS Proxy.
    // Password is rotated to alphanumeric-only, so no URL-encoding needed.
    const dbUsername = props.dbSecret.secretValueFromJson('username').unsafeUnwrap();
    const dbPassword = props.dbSecret.secretValueFromJson('password').unsafeUnwrap();
    const databaseUrl = `postgresql://${dbUsername}:${dbPassword}@${props.proxyEndpoint}:5432/penyzen?schema=public&sslmode=require`;

    // ── Shared Lambda environment ──────────────────────────────────────────
    const commonEnv = {
      NODE_ENV: 'production',
      COGNITO_USER_POOL_ID: props.userPool.userPoolId,
      COGNITO_APP_CLIENT_ID: props.userPoolClient.userPoolClientId,
      COGNITO_REGION: this.region,
      DB_SECRET_ARN: props.dbSecret.secretArn,
      DB_PROXY_ENDPOINT: props.proxyEndpoint,
      DATABASE_URL: databaseUrl,
      SQS_NOTIFICATION_QUEUE_URL: props.notificationQueue.queueUrl,
      S3_MEDIA_BUCKET: props.mediaBucket.bucketName,
      S3_RECEIPTS_BUCKET: props.receiptsBucket.bucketName,
      CLOUDFRONT_DOMAIN: props.cloudfrontDomain,
    };

    // Stripe keys are baked into Lambda env via Secrets Manager dynamic
    // references resolved at deploy time. A pure secret-value rotation
    // produces no template diff, so CloudFormation won't re-resolve them.
    // Bump this string after every Secrets Manager rotation to force the
    // Stripe Lambdas to redeploy and pick up the new values.
    const secretRev = '2';

    // ── Lambda Functions ───────────────────────────────────────────────────

    const userServiceLambda = new PenyzenLambda(this, 'UserService', {
      serviceName: 'user-service',
      bundlePath: path.join(serviceRoot, 'user-service/dist'),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSg],
      layers: [prismaLayer],
      environment: {
        ...commonEnv,
        // Stripe secret key loaded from Secrets Manager at cold start via env — replace with
        // Lambda extension for true secret rotation without redeployment
        STRIPE_SECRET_KEY: props.dbSecret.secretValueFromJson('STRIPE_SECRET_KEY').unsafeUnwrap(),
        STRIPE_IDENTITY_WEBHOOK_SECRET: props.dbSecret.secretValueFromJson('STRIPE_IDENTITY_WEBHOOK_SECRET').unsafeUnwrap(),
        SECRET_REV: secretRev,
      },
    });

    const campaignServiceLambda = new PenyzenLambda(this, 'CampaignService', {
      serviceName: 'campaign-service',
      bundlePath: path.join(serviceRoot, 'campaign-service/dist'),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSg],
      layers: [prismaLayer],
      environment: commonEnv,
    });

    const paymentServiceLambda = new PenyzenLambda(this, 'PaymentService', {
      serviceName: 'payment-service',
      bundlePath: path.join(serviceRoot, 'payment-service/dist'),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSg],
      layers: [prismaLayer],
      environment: {
        ...commonEnv,
        STRIPE_SECRET_KEY: props.dbSecret.secretValueFromJson('STRIPE_SECRET_KEY').unsafeUnwrap(),
        STRIPE_WEBHOOK_SECRET: props.dbSecret.secretValueFromJson('STRIPE_WEBHOOK_SECRET').unsafeUnwrap(),
        STRIPE_CONNECT_REDIRECT_URL: `https://www.penyzen.com/dashboard/connect`,
        API_URL: `https://api.penyzen.com`,
        PLATFORM_FEE_PERCENT: '2.5',
        SECRET_REV: secretRev,
      },
    });

    // notification-service: NOT in VPC (no DB access needed)
    const notificationServiceLambda = new PenyzenLambda(this, 'NotificationService', {
      serviceName: 'notification-service',
      bundlePath: path.join(serviceRoot, 'notification-service/dist'),
      timeout: cdk.Duration.seconds(60),
      environment: {
        ...commonEnv,
        SES_FROM_EMAIL: 'noreply@penyzen.com',
        SES_REPLY_TO: 'support@penyzen.com',
        SES_REGION: this.region,
        APP_NAME: 'Penyzen',
        APP_URL: 'https://www.penyzen.com',
      },
    });

    // ── IAM permissions ────────────────────────────────────────────────────

    // All VPC Lambdas need to read the DB secret
    props.dbSecret.grantRead(userServiceLambda.fn);
    props.dbSecret.grantRead(campaignServiceLambda.fn);
    props.dbSecret.grantRead(paymentServiceLambda.fn);

    // Services that publish to SQS
    props.notificationQueue.grantSendMessages(userServiceLambda.fn);
    props.notificationQueue.grantSendMessages(campaignServiceLambda.fn);
    props.notificationQueue.grantSendMessages(paymentServiceLambda.fn);

    // notification-service consumes from SQS
    props.notificationQueue.grantConsumeMessages(notificationServiceLambda.fn);

    // campaign-service can write to S3 media bucket
    props.mediaBucket.grantPut(campaignServiceLambda.fn);

    // notification-service sends SES emails
    notificationServiceLambda.fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
      }),
    );

    // user-service manages Cognito users
    userServiceLambda.fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminConfirmSignUp',
          'cognito-idp:AdminInitiateAuth',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminUpdateUserAttributes',
        ],
        resources: [props.userPool.userPoolArn],
      }),
    );

    // SQS → notification-service event source mapping
    notificationServiceLambda.fn.addEventSource(
      new lambdaEventSources.SqsEventSource(props.notificationQueue, {
        batchSize: 10,
        maxConcurrency: 5,
        reportBatchItemFailures: true, // Enables partial batch failure reporting
      }),
    );

    // ── API Gateway HTTP API ───────────────────────────────────────────────

    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.${this.region}.amazonaws.com/${props.userPool.userPoolId}`,
      {
        jwtAudience: [props.userPoolClient.userPoolClientId],
        identitySource: ['$request.header.Authorization'],
      },
    );

    this.api = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `penyzen-api-${props.envName}`,
      description: 'Penyzen Crowdfunding Platform API',
      corsPreflight: {
        allowOrigins: [
          'https://www.penyzen.com',
          'https://dev.penyzen.com',
          'https://d36f230uhjp2x3.amplifyapp.com', // Amplify default domain (fallback)
          'http://localhost:3000',
        ],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.PATCH,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.hours(24),
      },
      defaultAuthorizer: jwtAuthorizer, // All routes require JWT by default
    });

    const userIntegration = new integrations.HttpLambdaIntegration('UserIntegration', userServiceLambda.fn);
    const campaignIntegration = new integrations.HttpLambdaIntegration('CampaignIntegration', campaignServiceLambda.fn);
    const paymentIntegration = new integrations.HttpLambdaIntegration('PaymentIntegration', paymentServiceLambda.fn);

    // ── Route registrations ────────────────────────────────────────────────

    const noAuth = { authorizer: new apigatewayv2.HttpNoneAuthorizer() };

    // Authed catch-all routes must NOT include OPTIONS. An `ANY {proxy+}`
    // route swallows the browser's CORS preflight and runs it through the
    // JWT authorizer; preflights carry no Authorization header, so they
    // get 401 and the real request is blocked. Listing explicit methods
    // (no OPTIONS) lets API Gateway's automatic CORS answer preflight.
    const proxyMethods = [
      apigatewayv2.HttpMethod.GET,
      apigatewayv2.HttpMethod.POST,
      apigatewayv2.HttpMethod.PUT,
      apigatewayv2.HttpMethod.PATCH,
      apigatewayv2.HttpMethod.DELETE,
    ];

    // Auth routes (public)
    this.api.addRoutes({ path: '/v1/auth/{proxy+}', methods: [apigatewayv2.HttpMethod.ANY], integration: userIntegration, ...noAuth });

    // listMyCampaigns is handled by campaign-service but sits under the
    // /v1/users namespace. This explicit route must win over the
    // /v1/users/{proxy+} -> user-service catch-all below (HTTP APIs route
    // by most-specific match, so the literal path takes precedence).
    this.api.addRoutes({ path: '/v1/users/me/campaigns', methods: [apigatewayv2.HttpMethod.GET], integration: campaignIntegration });

    // User routes
    this.api.addRoutes({ path: '/v1/users/{proxy+}', methods: proxyMethods, integration: userIntegration });

    // Organization routes
    this.api.addRoutes({ path: '/v1/organizations/{proxy+}', methods: proxyMethods, integration: userIntegration });
    this.api.addRoutes({ path: '/v1/organizations', methods: [apigatewayv2.HttpMethod.POST], integration: userIntegration });

    // KYC routes
    this.api.addRoutes({ path: '/v1/kyc/{proxy+}', methods: proxyMethods, integration: userIntegration });

    // Campaign routes (public GET)
    this.api.addRoutes({ path: '/v1/campaigns', methods: [apigatewayv2.HttpMethod.GET], integration: campaignIntegration, ...noAuth });
    this.api.addRoutes({ path: '/v1/campaigns/{campaignId}', methods: [apigatewayv2.HttpMethod.GET], integration: campaignIntegration, ...noAuth });
    this.api.addRoutes({ path: '/v1/campaigns/{campaignId}/milestones', methods: [apigatewayv2.HttpMethod.GET], integration: campaignIntegration, ...noAuth });
    this.api.addRoutes({ path: '/v1/campaigns/{campaignId}/updates', methods: [apigatewayv2.HttpMethod.GET], integration: campaignIntegration, ...noAuth });
    this.api.addRoutes({ path: '/v1/campaigns/{campaignId}/donations', methods: [apigatewayv2.HttpMethod.GET], integration: paymentIntegration, ...noAuth });

    // Campaign routes (authenticated)
    this.api.addRoutes({ path: '/v1/campaigns', methods: [apigatewayv2.HttpMethod.POST], integration: campaignIntegration });
    this.api.addRoutes({ path: '/v1/campaigns/{campaignId}', methods: [apigatewayv2.HttpMethod.PATCH, apigatewayv2.HttpMethod.DELETE], integration: campaignIntegration });
    this.api.addRoutes({ path: '/v1/campaigns/{campaignId}/{proxy+}', methods: proxyMethods, integration: campaignIntegration });

    // Payment routes
    this.api.addRoutes({ path: '/v1/donations', methods: [apigatewayv2.HttpMethod.POST, apigatewayv2.HttpMethod.GET], integration: paymentIntegration });
    this.api.addRoutes({ path: '/v1/donations/{donationId}', methods: [apigatewayv2.HttpMethod.GET], integration: paymentIntegration });
    this.api.addRoutes({ path: '/v1/connect/{proxy+}', methods: proxyMethods, integration: paymentIntegration });

    // Stripe webhook (public — verified by Stripe signature internally)
    this.api.addRoutes({ path: '/v1/webhooks/{proxy+}', methods: [apigatewayv2.HttpMethod.POST], integration: paymentIntegration, ...noAuth });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.apiEndpoint,
      exportName: `penyzen-api-url-${props.envName}`,
    });
  }
}
