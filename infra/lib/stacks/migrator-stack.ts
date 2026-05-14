import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';

export interface MigratorStackProps extends cdk.StackProps {
  envName: 'dev' | 'prod';
  vpc: ec2.IVpc;
  lambdaSg: ec2.ISecurityGroup;
  dbSecret: secretsmanager.ISecret;
  proxyEndpoint: string;
}

export class MigratorStack extends cdk.Stack {
  public readonly fn: lambda.Function;

  constructor(scope: Construct, id: string, props: MigratorStackProps) {
    super(scope, id, props);

    const bundlePath = path.join(__dirname, '../../../services/db-migrator/dist');

    this.fn = new lambda.Function(this, 'DbMigrator', {
      functionName: `penyzen-db-migrator-${props.envName}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      code: lambda.Code.fromAsset(bundlePath),
      handler: 'handler.handler',
      memorySize: 512,
      timeout: cdk.Duration.minutes(5),
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [props.lambdaSg],
      environment: {
        DB_SECRET_ARN: props.dbSecret.secretArn,
        DB_PROXY_ENDPOINT: props.proxyEndpoint,
      },
      logGroup: new logs.LogGroup(this, 'LogGroup', {
        logGroupName: `/aws/lambda/penyzen-db-migrator-${props.envName}`,
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    props.dbSecret.grantRead(this.fn);

    new cdk.CfnOutput(this, 'MigratorFunctionName', {
      value: this.fn.functionName,
    });
  }
}
