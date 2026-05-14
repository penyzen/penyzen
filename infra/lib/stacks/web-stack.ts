import * as cdk from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface WebStackProps extends cdk.StackProps {
  envName: 'dev' | 'prod';

  /** Root domain you own in Route 53, e.g. 'penyzen.com'. */
  rootDomain: string;
  /** Existing Route 53 hosted zone ID for `rootDomain`. */
  hostedZoneId: string;
  /** Subdomain to expose this branch on, e.g. 'dev'. Final URL = `${subdomain}.${rootDomain}`. */
  subdomain: string;

  /** API + Cognito values exposed to the browser bundle. */
  publicApiUrl: string;
  cognitoUserPoolId: string;
  cognitoAppClientId: string;
  cognitoRegion: string;

  /** Optional: github repo URL like 'https://github.com/<user>/<repo>'. If omitted, the app is created without a source connection — connect it in the Amplify Console after deploy. */
  repositoryUrl?: string;
  /** GitHub personal-access token with repo scope. Pass via CDK context: `cdk deploy -c github_token=ghp_...`. */
  githubAccessToken?: string;
  /** Branch in the source repo to build, default 'master'. */
  sourceBranch?: string;
}

const BUILD_SPEC = `version: 1
applications:
  - appRoot: apps/web
    frontend:
      phases:
        preBuild:
          commands:
            - cd ../.. && npm ci
            - cd apps/web
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - .next/cache/**/*
`;

export class WebStack extends cdk.Stack {
  public readonly app: amplify.CfnApp;
  public readonly branch: amplify.CfnBranch;
  public readonly domain: amplify.CfnDomain;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    // Service role Amplify uses to read repo + write CloudWatch logs.
    const role = new iam.Role(this, 'AmplifyServiceRole', {
      assumedBy: new iam.ServicePrincipal('amplify.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify'),
      ],
    });

    const branchName = props.sourceBranch ?? 'master';
    const fullDomain = `${props.subdomain}.${props.rootDomain}`;

    this.app = new amplify.CfnApp(this, 'WebApp', {
      name: `penyzen-web-${props.envName}`,
      description: 'Penyzen Next.js frontend',
      iamServiceRole: role.roleArn,
      // Web Compute = SSR/RSC support (vs WEB = static only).
      platform: 'WEB_COMPUTE',
      buildSpec: BUILD_SPEC,
      ...(props.repositoryUrl
        ? {
            repository: props.repositoryUrl,
            ...(props.githubAccessToken && { accessToken: props.githubAccessToken }),
          }
        : {}),
      environmentVariables: [
        { name: 'NEXT_PUBLIC_API_URL', value: props.publicApiUrl },
        { name: 'PENYZEN_API_URL', value: props.publicApiUrl },
        { name: 'NEXT_PUBLIC_COGNITO_USER_POOL_ID', value: props.cognitoUserPoolId },
        { name: 'NEXT_PUBLIC_COGNITO_APP_CLIENT_ID', value: props.cognitoAppClientId },
        { name: 'NEXT_PUBLIC_COGNITO_REGION', value: props.cognitoRegion },
        { name: 'NEXT_PUBLIC_APP_NAME', value: 'Penyzen' },
        { name: 'AMPLIFY_MONOREPO_APP_ROOT', value: 'apps/web' },
        // Required for SSR Next.js builds on Amplify
        { name: '_LIVE_UPDATES', value: '[{"name":"Next.js version","pkg":"next-version","type":"internal","version":"latest"}]' },
      ],
      customRules: [
        // Required for Next.js Image Optimization on Amplify Compute
        { source: '/_next/image/<*>', target: '/_next/image/<*>', status: '200' },
      ],
    });

    this.branch = new amplify.CfnBranch(this, 'Branch', {
      appId: this.app.attrAppId,
      branchName,
      stage: props.envName === 'prod' ? 'PRODUCTION' : 'DEVELOPMENT',
      framework: 'Next.js - SSR',
      enableAutoBuild: !!props.repositoryUrl,
      enablePerformanceMode: false,
    });

    // Verify Route 53 hosted zone exists (lookup, not creation)
    route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.rootDomain,
    });

    this.domain = new amplify.CfnDomain(this, 'Domain', {
      appId: this.app.attrAppId,
      domainName: props.rootDomain,
      enableAutoSubDomain: false,
      subDomainSettings: [
        { prefix: props.subdomain, branchName },
      ],
    });

    new cdk.CfnOutput(this, 'AmplifyAppId', { value: this.app.attrAppId });
    new cdk.CfnOutput(this, 'AmplifyDefaultDomain', { value: this.app.attrDefaultDomain });
    new cdk.CfnOutput(this, 'CustomDomain', { value: `https://${fullDomain}` });
    new cdk.CfnOutput(this, 'AmplifyConsoleUrl', {
      value: `https://${this.region}.console.aws.amazon.com/amplify/home?region=${this.region}#/${this.app.attrAppId}`,
    });
  }
}
