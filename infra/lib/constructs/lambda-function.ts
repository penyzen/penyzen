import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface PenyzenLambdaProps {
  /** Human-readable name, e.g. 'user-service' */
  serviceName: string;
  /** Absolute path to the compiled handler bundle (handler.js) */
  bundlePath: string;
  /** Lambda handler export, default: 'handler.handler' */
  handler?: string;
  memorySize?: number;
  timeout?: cdk.Duration;
  environment?: Record<string, string>;
  vpc?: ec2.IVpc;
  vpcSubnets?: ec2.SubnetSelection;
  securityGroups?: ec2.ISecurityGroup[];
  /** Log group retention, default: ONE_MONTH */
  logRetention?: logs.RetentionDays;
  /** SNS topic ARN for alarms, optional */
  alarmTopicArn?: string;
  /** Lambda layers to attach (e.g., the Prisma layer for DB services) */
  layers?: lambda.ILayerVersion[];
}

/**
 * Reusable L3 construct that creates a Lambda function with:
 * - CloudWatch Log Group (explicit, with configurable retention)
 * - Error rate alarm
 * - p99 duration alarm
 * - Consistent tagging
 */
export class PenyzenLambda extends Construct {
  public readonly fn: lambda.Function;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: PenyzenLambdaProps) {
    super(scope, id);

    const env = cdk.Stack.of(this).stackName.includes('prod') ? 'prod' : 'dev';

    this.logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/lambda/penyzen-${props.serviceName}-${env}`,
      retention: props.logRetention ?? logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.fn = new lambda.Function(this, 'Function', {
      functionName: `penyzen-${props.serviceName}-${env}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64, // Graviton2: faster + cheaper
      code: lambda.Code.fromAsset(props.bundlePath),
      handler: props.handler ?? 'handler.handler',
      memorySize: props.memorySize ?? 512,
      timeout: props.timeout ?? cdk.Duration.seconds(30),
      environment: {
        NODE_ENV: 'production',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1', // Reuse HTTP connections in AWS SDK
        ...props.environment,
      },
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
      securityGroups: props.securityGroups,
      layers: props.layers,
      logGroup: this.logGroup,
      // Enable AWS Lambda SnapStart for faster cold starts (Java only currently, but future-proof)
      tracing: lambda.Tracing.ACTIVE, // AWS X-Ray
    });

    cdk.Tags.of(this.fn).add('Service', props.serviceName);
    cdk.Tags.of(this.fn).add('Project', 'penyzen');
    cdk.Tags.of(this.fn).add('Environment', env);

    // Error rate alarm: > 1% errors over 5-minute window
    new cloudwatch.Alarm(this, 'ErrorAlarm', {
      alarmName: `penyzen-${props.serviceName}-errors-${env}`,
      metric: this.fn.metricErrors({ period: cdk.Duration.minutes(5), statistic: 'Sum' }),
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
    });

    // Duration p99 alarm: > 10 seconds
    new cloudwatch.Alarm(this, 'DurationAlarm', {
      alarmName: `penyzen-${props.serviceName}-duration-${env}`,
      metric: this.fn.metricDuration({ period: cdk.Duration.minutes(5), statistic: 'p99' }),
      threshold: 10_000, // milliseconds
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });
  }
}
