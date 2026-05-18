#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { QueueStack } from '../lib/stacks/queue-stack';
import { ApiStack } from '../lib/stacks/api-stack';
import { MigratorStack } from '../lib/stacks/migrator-stack';
import { WebStack } from '../lib/stacks/web-stack';

const app = new cdk.App();

// Resolve environment from CDK context or environment variable
const envName = (app.node.tryGetContext('env') as string) ?? process.env['DEPLOY_ENV'] ?? 'dev';
const account = process.env['CDK_DEFAULT_ACCOUNT'] ?? process.env['AWS_ACCOUNT_ID'];
const region = process.env['CDK_DEFAULT_REGION'] ?? process.env['AWS_REGION'] ?? 'us-east-1';

if (!account) {
  throw new Error(
    'AWS_ACCOUNT_ID or CDK_DEFAULT_ACCOUNT must be set.\n' +
    'Run: export AWS_ACCOUNT_ID=123456789012',
  );
}

const awsEnv: cdk.Environment = { account, region };

// ── Stack instantiation in dependency order ────────────────────────────────

const networkStack = new NetworkStack(app, `PenyzenNetwork-${envName}`, {
  envName: envName as 'dev' | 'prod',
  env: awsEnv,
  stackName: `penyzen-network-${envName}`,
  description: 'Penyzen VPC, subnets, and security groups',
  tags: { Project: 'penyzen', Environment: envName },
});

const databaseStack = new DatabaseStack(app, `PenyzenDatabase-${envName}`, {
  envName: envName as 'dev' | 'prod',
  env: awsEnv,
  stackName: `penyzen-database-${envName}`,
  description: 'Penyzen Aurora Serverless v2 and RDS Proxy',
  vpc: networkStack.vpc,
  lambdaSg: networkStack.lambdaSg,
  tags: { Project: 'penyzen', Environment: envName },
});

const authStack = new AuthStack(app, `PenyzenAuth-${envName}`, {
  envName: envName as 'dev' | 'prod',
  env: awsEnv,
  stackName: `penyzen-auth-${envName}`,
  description: 'Penyzen Cognito User Pool and App Client',
  tags: { Project: 'penyzen', Environment: envName },
});

const storageStack = new StorageStack(app, `PenyzenStorage-${envName}`, {
  envName: envName as 'dev' | 'prod',
  env: awsEnv,
  stackName: `penyzen-storage-${envName}`,
  description: 'Penyzen S3 buckets and CloudFront CDN',
  tags: { Project: 'penyzen', Environment: envName },
});

const queueStack = new QueueStack(app, `PenyzenQueues-${envName}`, {
  envName: envName as 'dev' | 'prod',
  env: awsEnv,
  stackName: `penyzen-queues-${envName}`,
  description: 'Penyzen SQS queues and DLQs',
  tags: { Project: 'penyzen', Environment: envName },
});

const apiStack = new ApiStack(app, `PenyzenApi-${envName}`, {
  envName: envName as 'dev' | 'prod',
  env: awsEnv,
  stackName: `penyzen-api-${envName}`,
  description: 'Penyzen API Gateway, Lambda functions, and IAM roles',
  vpc: networkStack.vpc,
  lambdaSg: networkStack.lambdaSg,
  dbSecret: databaseStack.secret,
  proxyEndpoint: databaseStack.proxyEndpoint,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  notificationQueue: queueStack.notificationQueue,
  mediaBucket: storageStack.mediaBucket,
  receiptsBucket: storageStack.receiptsBucket,
  cloudfrontDomain: storageStack.distribution.distributionDomainName,
  tags: { Project: 'penyzen', Environment: envName },
});

apiStack.addDependency(networkStack);
apiStack.addDependency(databaseStack);
apiStack.addDependency(authStack);
apiStack.addDependency(storageStack);
apiStack.addDependency(queueStack);

new MigratorStack(app, `PenyzenMigrator-${envName}`, {
  envName: envName as 'dev' | 'prod',
  env: awsEnv,
  stackName: `penyzen-migrator-${envName}`,
  description: 'Penyzen one-shot DB migration Lambda',
  vpc: networkStack.vpc,
  lambdaSg: networkStack.lambdaSg,
  dbSecret: databaseStack.secret,
  proxyEndpoint: databaseStack.proxyEndpoint,
  tags: { Project: 'penyzen', Environment: envName },
});

// Web frontend (Amplify Hosting). GitHub repo + token are optional and read from CDK context:
//   cdk deploy PenyzenWeb-dev -c github_repo=https://github.com/<user>/<repo> -c github_token=ghp_xxx
const githubRepo = app.node.tryGetContext('github_repo') as string | undefined;
const githubToken = app.node.tryGetContext('github_token') as string | undefined;
const stripePk = app.node.tryGetContext('stripe_pk') as string | undefined;

new WebStack(app, `PenyzenWeb-${envName}`, {
  envName: envName as 'dev' | 'prod',
  env: awsEnv,
  stackName: `penyzen-web-${envName}`,
  description: 'Penyzen Next.js frontend on Amplify Hosting',
  rootDomain: 'penyzen.com',
  hostedZoneId: 'Z04009072KRDXZRF0HM85',
  subdomain: envName === 'prod' ? 'www' : 'dev',
  publicApiUrl: apiStack.api.apiEndpoint,
  cognitoUserPoolId: authStack.userPool.userPoolId,
  cognitoAppClientId: authStack.userPoolClient.userPoolClientId,
  cognitoRegion: awsEnv.region!,
  ...(githubRepo && { repositoryUrl: githubRepo }),
  ...(githubToken && { githubAccessToken: githubToken }),
  ...(stripePk && { stripePublishableKey: stripePk }),
  sourceBranch: envName === 'prod' ? 'master' : 'master',
  tags: { Project: 'penyzen', Environment: envName },
});

app.synth();
