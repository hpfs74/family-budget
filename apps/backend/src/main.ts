#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BudgetPipelineStack } from './pipeline-stack.js';

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT || '495133941005';

new BudgetPipelineStack(app, 'BudgetPipelineStack', {
  env: { account, region: 'eu-south-1' },
});
