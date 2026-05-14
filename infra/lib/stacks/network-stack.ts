import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkStackProps extends cdk.StackProps {
  envName: 'dev' | 'prod';
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly lambdaSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `penyzen-${props.envName}`,
      maxAzs: 2,
      // Cost-optimized MVP: 1 NAT Gateway (no HA). Change to 2+ for production HA.
      natGateways: props.envName === 'prod' ? 2 : 1,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // VPC endpoints to avoid NAT Gateway costs for AWS service calls
    this.vpc.addGatewayEndpoint('S3Endpoint', { service: ec2.GatewayVpcEndpointAwsService.S3 });

    this.vpc.addInterfaceEndpoint('SqsEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SQS,
      privateDnsEnabled: true,
    });

    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      privateDnsEnabled: true,
    });

    // Lambda security group: outbound to internet (for Stripe, Cognito) via NAT
    this.lambdaSg = new ec2.SecurityGroup(this, 'LambdaSg', {
      vpc: this.vpc,
      securityGroupName: `penyzen-lambda-${props.envName}`,
      description: 'Lambda functions - outbound only',
      allowAllOutbound: true,
    });

    new cdk.CfnOutput(this, 'VpcId', { value: this.vpc.vpcId, exportName: `penyzen-vpc-id-${props.envName}` });
  }
}
