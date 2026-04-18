#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/stacks/network-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { AuthStack } from '../lib/stacks/auth-stack';
import { StorageStack } from '../lib/stacks/storage-stack';
import { QueueStack } from '../lib/stacks/queue-stack';
import { ApiStack } from '../lib/stacks/api-stack';

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
  env: envName as 'dev' | 'prod',
  stackName: `penyzen-network-${envName}`,
  description: 'Penyzen VPC, subnets, and security groups',
  environment: awsEnv,
  tags: { Project: 'penyzen', Environment: envName },
});

const databaseStack = new DatabaseStack(app, `PenyzenDatabase-${envName}`, {
  env: envName as 'dev' | 'prod',
  stackName: `penyzen-database-${envName}`,
  description: 'Penyzen Aurora Serverless v2 and RDS Proxy',
  environment: awsEnv,
  vpc: networkStack.vpc,
  rdsSg: networkStack.rdsSg,
  lambdaSg: networkStack.lambdaSg,
  tags: { Project: 'penyzen', Environment: envName },
});
databaseStack.addDependency(networkStack);

const authStack = new AuthStack(app, `PenyzenAuth-${envName}`, {
  env: envName as 'dev' | 'prod',
  stackName: `penyzen-auth-${envName}`,
  description: 'Penyzen Cognito User Pool and App Client',
  environment: awsEnv,
  tags: { Project: 'penyzen', Environment: envName },
});

const storageStack = new StorageStack(app, `PenyzenStorage-${envName}`, {
  env: envName as 'dev' | 'prod',
  stackName: `penyzen-storage-${envName}`,
  description: 'Penyzen S3 buckets and CloudFront CDN',
  environment: awsEnv,
  tags: { Project: 'penyzen', Environment: envName },
});

const queueStack = new QueueStack(app, `PenyzenQueues-${envName}`, {
  env: envName as 'dev' | 'prod',
  stackName: `penyzen-queues-${envName}`,
  description: 'Penyzen SQS queues and DLQs',
  environment: awsEnv,
  tags: { Project: 'penyzen', Environment: envName },
});

const apiStack = new ApiStack(app, `PenyzenApi-${envName}`, {
  env: envName as 'dev' | 'prod',
  stackName: `penyzen-api-${envName}`,
  description: 'Penyzen API Gateway, Lambda functions, and IAM roles',
  environment: awsEnv,
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

app.synth();
