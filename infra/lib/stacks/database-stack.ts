import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  envName: 'dev' | 'prod';
  vpc: ec2.IVpc;
  lambdaSg: ec2.ISecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  public readonly cluster: rds.DatabaseCluster;
  public readonly proxy: rds.DatabaseProxy;
  public readonly secret: secretsmanager.ISecret;
  public readonly proxyEndpoint: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    // RDS security group lives here, co-located with the cluster and proxy it guards.
    // Keeping it in this stack avoids a cross-stack token cycle caused by CDK's
    // DatabaseProxy automatically calling cluster.connections.allowDefaultPortFrom(proxy),
    // which would write a cluster-endpoint-port token into NetworkStack.
    const rdsSg = new ec2.SecurityGroup(this, 'RdsSg', {
      vpc: props.vpc,
      securityGroupName: `penyzen-rds-${props.envName}`,
      description: 'Aurora PostgreSQL / RDS Proxy - inbound from Lambda only',
      allowAllOutbound: false,
    });

    // props.lambdaSg lives in NetworkStack; this ingress rule creates a
    // Database→Network dependency (one direction only — no cycle).
    rdsSg.addIngressRule(
      props.lambdaSg,
      ec2.Port.tcp(5432),
      'Allow Lambda to connect to RDS Proxy',
    );

    // Aurora Serverless v2 — scales to zero when idle (great for MVP cost)
    this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.of('15.8', '15'),
      }),
      clusterIdentifier: `penyzen-${props.envName}`,
      writer: rds.ClusterInstance.serverlessV2('writer', {
        scaleWithWriter: true,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: props.envName === 'prod' ? 8 : 4,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSg],
      defaultDatabaseName: 'penyzen',
      storageEncrypted: true,
      deletionProtection: props.envName === 'prod',
      backup: {
        retention: cdk.Duration.days(props.envName === 'prod' ? 14 : 3),
        preferredWindow: '03:00-04:00',
      },
      parameterGroup: new rds.ParameterGroup(this, 'ParamGroup', {
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_15_4,
        }),
        parameters: {
          max_connections: '1000',
          idle_in_transaction_session_timeout: '60000',
        },
      }),
      removalPolicy: props.envName === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.secret = this.cluster.secret!;

    // RDS Proxy — essential for Lambda (multiplexes thousands of short-lived connections)
    this.proxy = new rds.DatabaseProxy(this, 'RdsProxy', {
      proxyTarget: rds.ProxyTarget.fromCluster(this.cluster),
      secrets: [this.secret],
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [rdsSg],
      dbProxyName: `penyzen-proxy-${props.envName}`,
      requireTLS: true,
      iamAuth: false,
    });

    this.proxyEndpoint = this.proxy.endpoint;

    new cdk.CfnOutput(this, 'ProxyEndpoint', {
      value: this.proxy.endpoint,
      exportName: `penyzen-db-proxy-endpoint-${props.envName}`,
    });

    new cdk.CfnOutput(this, 'SecretArn', {
      value: this.secret.secretArn,
      exportName: `penyzen-db-secret-arn-${props.envName}`,
    });
  }
}
