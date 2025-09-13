#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from './backend-stack.js';

const app = new cdk.App();
new BackendStack(app, 'BudgetAppBackendStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
