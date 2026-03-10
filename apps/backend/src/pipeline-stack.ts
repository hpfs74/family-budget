import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { PipelineType } from 'aws-cdk-lib/aws-codepipeline';
import {
  CodePipeline,
  CodePipelineSource,
  ShellStep,
  CodeBuildStep,
} from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { BudgetAppStage } from './app-stage.js';

const BUDGET_APP_ACCOUNT = '495133941005';
const CODESTAR_CONNECTION_ARN =
  `arn:aws:codeconnections:eu-south-1:${BUDGET_APP_ACCOUNT}:connection/573b5341-5aa0-4a20-9294-87752d831c1a`;
const GITHUB_REPO = 'hpfs74/family-budget';

// n (node version manager) is pre-installed in CodeBuild standard:7.0
// Prepend to every step's commands to ensure Node 24 is active
const NODE24 = ['n 24', 'hash -r'];

export class BudgetPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const source = CodePipelineSource.connection(GITHUB_REPO, 'main', {
      connectionArn: CODESTAR_CONNECTION_ARN,
    });

    const pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: 'BudgetAppPipeline',
      selfMutation: true,
      crossAccountKeys: false,
      pipelineType: PipelineType.V2,
      synth: new ShellStep('Synth', {
        input: source,
        commands: [
          ...NODE24,
          'npm ci',
          'npm run build:backend',
          'npx cdk synth',
        ],
        primaryOutputDirectory: 'cdk.out',
      }),
    });

    // ── QA Stage ──────────────────────────────────────────────────────────────
    const qaAppStage = new BudgetAppStage(this, 'QA', {
      env: { account: BUDGET_APP_ACCOUNT, region: 'eu-south-1' },
      stackEnv: 'qa',
    });
    const qaStage = pipeline.addStage(qaAppStage);

    // Step 1: Backend integration tests against QA API Gateway
    qaStage.addPost(
      new CodeBuildStep('BackendE2E', {
        input: source,
        envFromCfnOutputs: {
          API_BASE_URL: qaAppStage.apiUrlOutput,
          COGNITO_CLIENT_ID: qaAppStage.cognitoClientIdOutput,
        },
        env: {
          AWS_REGION: 'eu-south-1',
        },
        buildEnvironment: {
          environmentVariables: {
            E2E_COGNITO_USER: {
              value: '/budget/e2e/cognito-credentials:username',
              type: cdk.aws_codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
            },
            E2E_COGNITO_PASS: {
              value: '/budget/e2e/cognito-credentials:password',
              type: cdk.aws_codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
            },
          },
        },
        commands: [
          ...NODE24,
          'npm ci',
          'npx nx e2e @budget-app/backend-e2e',
        ],
      }),
    );

    // Step 2: Playwright UI tests — build frontend against QA API, run browser tests
    qaStage.addPost(
      new CodeBuildStep('PlaywrightE2E', {
        input: source,
        envFromCfnOutputs: {
          VITE_API_ENDPOINT: qaAppStage.apiUrlOutput,
        },
        env: {
          CI: 'true',
        },
        commands: [
          ...NODE24,
          'npm ci',
          'npx playwright install --with-deps chromium',
          'npm run build',
          'npx nx e2e @budget-app/frontend-e2e',
        ],
      }),
    );

    // ── Prod Stage ─────────────────────────────────────────────────────────────
    const prodAppStage = new BudgetAppStage(this, 'Prod', {
      env: { account: BUDGET_APP_ACCOUNT, region: 'eu-south-1' },
      stackEnv: 'prod',
    });
    const prodStage = pipeline.addStage(prodAppStage);

    // Deploy frontend assets: build React app and sync to S3, invalidate CloudFront
    prodStage.addPost(
      new CodeBuildStep('DeployFrontend', {
        input: source,
        envFromCfnOutputs: {
          S3_BUCKET:          prodAppStage.bucketNameOutput!,
          CLOUDFRONT_DIST_ID: prodAppStage.distributionIdOutput!,
        },
        commands: [
          ...NODE24,
          'npm ci',
          // Read Cognito config from SSM and inject as VITE_ env vars for the frontend build
          'export VITE_COGNITO_DOMAIN=$(aws ssm get-parameter --name /budget/cognito/domain --query Parameter.Value --output text)',
          'export VITE_COGNITO_CLIENT_ID=$(aws ssm get-parameter --name /budget/cognito/clientId --query Parameter.Value --output text)',
          'export VITE_COGNITO_REGION=eu-south-1',
          'export VITE_COGNITO_REDIRECT_URI=https://budget.matteo.cool/callback',
          'export VITE_COGNITO_LOGOUT_URI=https://budget.matteo.cool/login',
          'VITE_API_ENDPOINT=/api/ npm run build',
          'aws s3 sync apps/frontend/dist/ s3://$S3_BUCKET/ --delete',
          'aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DIST_ID --paths "/*"',
        ],
        rolePolicyStatements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
              's3:ListBucket',
              's3:GetObject',
              's3:PutObject',
              's3:DeleteObject',
            ],
            resources: [
              `arn:aws:s3:::budget-matteo-cool-${BUDGET_APP_ACCOUNT}`,
              `arn:aws:s3:::budget-matteo-cool-${BUDGET_APP_ACCOUNT}/*`,
            ],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['cloudfront:CreateInvalidation'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['ssm:GetParameter'],
            resources: [
              `arn:aws:ssm:eu-south-1:${BUDGET_APP_ACCOUNT}:parameter/budget/cognito/*`,
            ],
          }),
        ],
      }),
    );

    // ── V2 trigger: fire on push to main via CodeConnections (no GitHub secrets needed) ──
    // The CDK L3 CodePipeline construct doesn't expose the source action for addTrigger(),
    // so we patch the CfnPipeline directly after buildPipeline() forces synthesis.
    pipeline.buildPipeline();
    const cfnPipeline = pipeline.pipeline.node.defaultChild as cdk.CfnResource;
    cfnPipeline.addPropertyOverride('Triggers', [
      {
        ProviderType: 'CodeStarSourceConnection',
        GitConfiguration: {
          SourceActionName: 'hpfs74_family-budget',
          Push: [{ Branches: { Includes: ['main'] } }],
        },
      },
    ]);
    // New executions supersede (cancel) any in-progress execution — one run at a time
    cfnPipeline.addPropertyOverride('ExecutionMode', 'SUPERSEDED');

    // Grant the pipeline role permission to USE the CodeConnections connection
    // (required for V2 push triggers to fire automatically on GitHub push)
    pipeline.pipeline.role.addToPrincipalPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'codestar-connections:UseConnection',
        'codeconnections:UseConnection',
      ],
      resources: [CODESTAR_CONNECTION_ARN],
    }));
  }
}
