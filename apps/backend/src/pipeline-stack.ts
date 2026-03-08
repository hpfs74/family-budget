import * as cdk from 'aws-cdk-lib';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
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
      // Pin Node 20 for all CodeBuild steps — default image uses Node 18
      // which is incompatible with Vite 7 and react-router-dom 7
      codeBuildDefaults: {
        partialBuildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              'runtime-versions': { nodejs: '20' },
            },
          },
        }),
      },
      synth: new ShellStep('Synth', {
        input: source,
        commands: [
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
        },
        commands: [
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
          'npm ci',
          'npx playwright install --with-deps chromium',
          'npm run build',
          'npx nx e2e @budget-app/frontend-e2e',
        ],
      }),
    );

    // ── Prod Stage ─────────────────────────────────────────────────────────────
    pipeline.addStage(
      new BudgetAppStage(this, 'Prod', {
        env: { account: BUDGET_APP_ACCOUNT, region: 'eu-south-1' },
        stackEnv: 'prod',
      }),
    );
  }
}
