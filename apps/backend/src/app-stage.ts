import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BackendStack } from './backend-stack.js';
import { AuthStack } from './auth-stack.js';
import { CertificateStack } from './certificate-stack.js';
import { FrontendStack } from './frontend-stack.js';

// Default AWS account for this project — used when env is not explicitly provided
const DEFAULT_ACCOUNT = '495133941005';

export interface BudgetAppStageProps extends cdk.StageProps {
  stackEnv: 'prod' | 'qa';
}

export class BudgetAppStage extends cdk.Stage {
  readonly apiUrlOutput: cdk.CfnOutput;
  readonly cognitoClientIdOutput: cdk.CfnOutput;
  readonly bucketNameOutput?: cdk.CfnOutput;
  readonly distributionIdOutput?: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: BudgetAppStageProps) {
    super(scope, id, props);

    const account = props.env?.account ?? DEFAULT_ACCOUNT;
    const region = props.env?.region ?? 'eu-south-1';

    const authStack = new AuthStack(this, 'BudgetAuthStack', {
      env: { account, region },
      stackEnv: props.stackEnv,
    });

    const backendStack = new BackendStack(this, 'BudgetAppBackendStack', {
      env: { account, region },
      stackEnv: props.stackEnv,
      userPool: authStack.userPool,
    });
    backendStack.addDependency(authStack);

    this.apiUrlOutput = backendStack.apiUrlOutput;
    this.cognitoClientIdOutput = authStack.userPoolClientIdOutput;

    if (props.stackEnv === 'prod') {
      const certStack = new CertificateStack(this, 'BudgetCertificateStack', {
        env: { account, region: 'us-east-1' },
      });

      const frontendStack = new FrontendStack(this, 'BudgetFrontendStack', {
        env: { account, region: 'eu-south-1' },
        crossRegionReferences: true,
        certificate: certStack.certificate,
      });

      this.bucketNameOutput = frontendStack.bucketNameOutput;
      this.distributionIdOutput = frontendStack.distributionIdOutput;
    }
  }
}
