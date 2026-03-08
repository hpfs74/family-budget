import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BackendStack } from './backend-stack.js';
import { CertificateStack } from './certificate-stack.js';
import { FrontendStack } from './frontend-stack.js';

export interface BudgetAppStageProps extends cdk.StageProps {
  stackEnv: 'prod' | 'qa';
}

export class BudgetAppStage extends cdk.Stage {
  readonly apiUrlOutput: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: BudgetAppStageProps) {
    super(scope, id, props);

    const account = props.env?.account ?? '495133941005';
    const region = props.env?.region ?? 'eu-south-1';

    const backendStack = new BackendStack(this, 'BudgetAppBackendStack', {
      env: { account, region },
      stackEnv: props.stackEnv,
    });

    this.apiUrlOutput = backendStack.apiUrlOutput;

    if (props.stackEnv === 'prod') {
      const certStack = new CertificateStack(this, 'BudgetCertificateStack', {
        env: { account, region: 'us-east-1' },
      });

      new FrontendStack(this, 'BudgetFrontendStack', {
        env: { account, region },
        crossRegionReferences: true,
        certificate: certStack.certificate,
      });
    }
  }
}
