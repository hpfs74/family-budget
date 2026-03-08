#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from './backend-stack.js';
import { CertificateStack } from './certificate-stack.js';
import { FrontendStack } from './frontend-stack.js';

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT || '495133941005';

// ── Backend (Lambda + API Gateway + DynamoDB) ─ eu-south-1 ─────────────
new BackendStack(app, 'BudgetAppBackendStack', {
  env: { account, region: 'eu-south-1' },
});

// ── Certificate (must be in us-east-1 for CloudFront) ──────────────────
const certStack = new CertificateStack(app, 'BudgetCertificateStack', {
  env: { account, region: 'us-east-1' },
});

// ── Frontend (S3 + CloudFront + Route 53) ─ eu-south-1 ─────────────────
new FrontendStack(app, 'BudgetFrontendStack', {
  env: { account, region: 'eu-south-1' },
  crossRegionReferences: true,       // needed to pass cert from us-east-1
  certificate: certStack.certificate,
});
