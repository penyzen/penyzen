import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  env: 'dev' | 'prod';
  vpc: ec2.IVpc;
  rdsSg: ec2.ISecurityGroup;
  lambdaSg: ec2.ISecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  public readonly cluster: rds.DatabaseCluster;
  public readonly proxy: rds.DatabaseProxy;
  public readonly secret: secretsmanager.ISecret;
  public readonly proxyEndpoint: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // Aurora Serverless v2 — scales to zero when idle (great for MVP cost)
    this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      clusterIdentifier: `penyzen-${props.env}`,
      writer: rds.ClusterInstance.serverlessV2('writer', {
        scaleWithWriter: true,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: props.env === 'prod' ? 8 : 4,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.rdsSg],
      defaultDatabaseName: 'penyzen',
      storageEncrypted: true,
      deletionProtection: props.env === 'prod',
      backup: {
        retention: cdk.Duration.days(props.env === 'prod' ? 14 : 3),
        preferredWindow: '03:00-04:00',
      },
      parameterGroup: new rds.ParameterGroup(this, 'ParamGroup', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_15_4,
        }),
        parameters: {
          // Increase max connections for RDS Proxy
          max_connections: '1000',
          // Reduce idle connection timeout
          idle_in_transaction_session_timeout: '60000', // 60s
        },
      }),
      removalPolicy: props.env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.secret = this.cluster.secret!;

    // RDS Proxy — essential for Lambda (multiplexes thousands of short-lived connections)
    this.proxy = new rds.DatabaseProxy(this, 'RdsProxy', {
      proxyTarget: rds.ProxyTarget.fromCluster(this.cluster),
      secrets: [this.secret],
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.rdsSg],
      dbProxyName: `penyzen-proxy-${props.env}`,
      // Lambda SG can connect to the proxy
      requireTLS: true,
      iamAuth: false, // Use password auth (simpler for MVP)
    });

    // Allow Lambda SG to connect to RDS Proxy port
    this.proxy.connections.allowFrom(
      props.lambdaSg,
      ec2.Port.tcp(5432),
      'Lambda -> RDS Proxy',
    );

    this.proxyEndpoint = this.proxy.endpoint;

    new cdk.CfnOutput(this, 'ProxyEndpoint', {
      value: this.proxy.endpoint,
      exportName: `penyzen-db-proxy-endpoint-${props.env}`,
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: this.secret.secretArn,
      exportName: `penyzen-db-secret-arn-${props.env}`,
    });
  }
}
