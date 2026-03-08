# CI/CD Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move deployment to AWS CodePipeline with a QA gate (backend-e2e + Playwright) before production, eliminating AWS credentials from GitHub.

**Architecture:** A self-mutating `BudgetPipelineStack` (CDK Pipelines) listens to `main` via a CodeStar Connection. On every push it deploys QA backend, runs both e2e suites against the real QA API GW, then deploys prod only if both pass.

**Tech Stack:** `aws-cdk-lib/pipelines` (`CodePipeline`, `CodeBuildStep`, `CodePipelineSource`), `axios` (backend-e2e HTTP calls), Playwright (frontend-e2e), GitHub Actions (SAST + audit only).

---

## Pre-requisites (manual, one-time)

Before running any task, do these once in the AWS console:

1. **Create a CodeStar Connection** to GitHub:
   - AWS Console → CodePipeline → Settings → Connections → Create connection → GitHub
   - Name it `budget-app-github`
   - Complete the OAuth flow, set status to "Available"
   - Copy the full ARN (looks like `arn:aws:codestar-connections:eu-south-1:495133941005:connection/XXXX`)

2. **Note your GitHub repo** owner/name (e.g. `matteo/family-budget`)

3. **Re-bootstrap CDK** with trust for CodePipeline (needed for CDK Pipelines self-mutation):
   ```bash
   npx cdk bootstrap aws://495133941005/eu-south-1 \
     --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess
   # Also bootstrap us-east-1 (for the certificate stack in prod)
   npx cdk bootstrap aws://495133941005/us-east-1 \
     --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess
   ```

---

## Task 1: Add `stackEnv` prop to `BackendStack`

**Files:**
- Modify: `apps/backend/src/backend-stack.ts`

**Step 1: Add `BackendStackProps` interface and suffix logic**

In `apps/backend/src/backend-stack.ts`, replace the class signature and top of the constructor:

```typescript
// Replace:
export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {

// With:
export interface BackendStackProps extends cdk.StackProps {
  stackEnv?: 'prod' | 'qa';
}

export class BackendStack extends cdk.Stack {
  readonly apiUrlOutput: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: BackendStackProps) {
```

Right after `super(scope, id, props);` add:
```typescript
    const suffix = props?.stackEnv === 'qa' ? '-QA' : '';
    const isQa = props?.stackEnv === 'qa';
```

**Step 2: Apply suffix to all 4 DynamoDB table names**

Change each `tableName` to append `suffix`:
```typescript
// Before:  tableName: 'BankTransactions',
// After:   tableName: `BankTransactions${suffix}`,

// Before:  tableName: 'BankAccounts',
// After:   tableName: `BankAccounts${suffix}`,

// Before:  tableName: 'Categories',
// After:   tableName: `Categories${suffix}`,

// Before:  tableName: 'BudgetPlanner',
// After:   tableName: `BudgetPlanner${suffix}`,
```

**Step 3: Use DESTROY removal policy for QA tables**

Wrap each table's `removalPolicy`:
```typescript
// Replace:  removalPolicy: cdk.RemovalPolicy.RETAIN,
// With:     removalPolicy: isQa ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
```
Apply this to all 4 tables.

**Step 4: Expose `apiUrlOutput` on the class**

In the Outputs section at the bottom, change the `ApiEndpoint` output to:
```typescript
    this.apiUrlOutput = new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });
```
(remove the `new cdk.CfnOutput(...)` assignment that was wrapping it before — just assign to `this.apiUrlOutput`)

**Step 5: Run backend unit tests**

```bash
npm run test:backend
```
Expected: all 88 tests pass (no Lambda code changed, only stack infrastructure).

**Step 6: Run CDK synth to verify both instantiation variants compile**

Temporarily edit `main.ts` (revert after) to test both:
```typescript
new BackendStack(app, 'TestQA', { env: { account, region: 'eu-south-1' }, stackEnv: 'qa' });
```
```bash
npm run cdk:synth 2>&1 | head -5
```
Expected: no TypeScript errors. Revert `main.ts` to original.

**Step 7: Commit**

```bash
git add apps/backend/src/backend-stack.ts
git commit -m "feat: add stackEnv prop to BackendStack for QA/prod namespacing"
```

---

## Task 2: Create `BudgetAppStage`

**Files:**
- Create: `apps/backend/src/app-stage.ts`

**Step 1: Create the file**

```typescript
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
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build:backend 2>&1 | tail -5
```
Expected: no errors.

**Step 3: Commit**

```bash
git add apps/backend/src/app-stage.ts
git commit -m "feat: add BudgetAppStage CDK Stage for QA and prod environments"
```

---

## Task 3: Create `BudgetPipelineStack`

**Files:**
- Create: `apps/backend/src/pipeline-stack.ts`

`aws-cdk-lib/pipelines` is already included in `aws-cdk-lib`. No new npm packages needed.

**Step 1: Create the file**

Replace `REPLACE_WITH_CONNECTION_ARN` and `REPLACE_WITH_GITHUB_OWNER/REPO` with the values from the pre-requisites.

```typescript
import * as cdk from 'aws-cdk-lib';
import {
  CodePipeline,
  CodePipelineSource,
  ShellStep,
  CodeBuildStep,
} from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import { BudgetAppStage } from './app-stage.js';

const CODESTAR_CONNECTION_ARN = 'REPLACE_WITH_CONNECTION_ARN';
const GITHUB_REPO = 'REPLACE_WITH_GITHUB_OWNER/REPO'; // e.g. 'matteo/family-budget'

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
    const qaStage = pipeline.addStage(
      new BudgetAppStage(this, 'QA', {
        env: { account: '495133941005', region: 'eu-south-1' },
        stackEnv: 'qa',
      }),
    );

    // Step 1: Backend integration tests
    qaStage.addPost(
      new CodeBuildStep('BackendE2E', {
        input: source,
        envFromCfnOutputs: {
          API_BASE_URL: qaStage.apiUrlOutput,
        },
        commands: [
          'npm ci',
          'npx nx e2e @budget-app/backend-e2e',
        ],
      }),
    );

    // Step 2: Playwright UI tests (builds frontend pointing at QA API)
    qaStage.addPost(
      new CodeBuildStep('PlaywrightE2E', {
        input: source,
        envFromCfnOutputs: {
          VITE_API_ENDPOINT: qaStage.apiUrlOutput,
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
        // Upload Playwright report on failure via buildspec overridehere is not natively supported;
        // artifacts are configured separately in the CodeBuild project
      }),
    );

    // ── Prod Stage ─────────────────────────────────────────────────────────────
    pipeline.addStage(
      new BudgetAppStage(this, 'Prod', {
        env: { account: '495133941005', region: 'eu-south-1' },
        stackEnv: 'prod',
      }),
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

```bash
npm run build:backend 2>&1 | tail -5
```
Expected: no errors.

**Step 3: Commit**

```bash
git add apps/backend/src/pipeline-stack.ts
git commit -m "feat: add BudgetPipelineStack with QA gate and self-mutating CodePipeline"
```

---

## Task 4: Update `main.ts` to use the pipeline stack

**Files:**
- Modify: `apps/backend/src/main.ts`

**Step 1: Replace the file contents**

```typescript
#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BudgetPipelineStack } from './pipeline-stack.js';

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT || '495133941005';

new BudgetPipelineStack(app, 'BudgetPipelineStack', {
  env: { account, region: 'eu-south-1' },
});
```

**Step 2: Run CDK synth**

```bash
npm run cdk:synth 2>&1 | tail -10
```
Expected: synthesizes `BudgetPipelineStack` template with no errors. You should see output like `Successfully synthesized to cdk.out`.

**Step 3: Commit**

```bash
git add apps/backend/src/main.ts
git commit -m "feat: update CDK entrypoint to instantiate BudgetPipelineStack"
```

---

## Task 5: Write backend-e2e integration tests

The existing `backend.spec.ts` is a placeholder. Replace it with real HTTP tests using `axios` (already in `package.json` dependencies).

**Files:**
- Modify: `apps/backend-e2e/src/backend/backend.spec.ts`

**Step 1: Write the tests**

```typescript
import axios, { AxiosInstance } from 'axios';

const baseURL = process.env['API_BASE_URL'];
if (!baseURL) throw new Error('API_BASE_URL env var is required');

const api: AxiosInstance = axios.create({
  baseURL: baseURL.replace(/\/$/, ''), // strip trailing slash
  timeout: 10_000,
});

// Track created resource IDs for cleanup
let createdAccountId: string;
let createdCategoryId: string;
let createdBudgetId: string;
let createdTransactionId: string;

describe('Accounts API', () => {
  it('creates an account', async () => {
    const res = await api.post('/accounts', {
      name: 'E2E Test Account',
      type: 'checking',
      balance: 1000,
      currency: 'EUR',
    });
    expect(res.status).toBe(201);
    expect(res.data.accountId).toBeDefined();
    createdAccountId = res.data.accountId;
  });

  it('lists accounts and includes the created one', async () => {
    const res = await api.get('/accounts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.some((a: { accountId: string }) => a.accountId === createdAccountId)).toBe(true);
  });

  it('gets the account by id', async () => {
    const res = await api.get(`/accounts/${createdAccountId}`);
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('E2E Test Account');
  });

  it('updates the account', async () => {
    const res = await api.put(`/accounts/${createdAccountId}`, { name: 'Updated E2E Account' });
    expect(res.status).toBe(200);
  });

  it('deletes the account', async () => {
    const res = await api.delete(`/accounts/${createdAccountId}`);
    expect(res.status).toBe(204);
  });
});

describe('Categories API', () => {
  it('creates a category', async () => {
    const res = await api.post('/categories', { name: 'E2E Category', color: '#ff0000' });
    expect(res.status).toBe(201);
    expect(res.data.categoryId).toBeDefined();
    createdCategoryId = res.data.categoryId;
  });

  it('lists categories and includes the created one', async () => {
    const res = await api.get('/categories');
    expect(res.status).toBe(200);
    expect(res.data.some((c: { categoryId: string }) => c.categoryId === createdCategoryId)).toBe(true);
  });

  it('gets the category by id', async () => {
    const res = await api.get(`/categories/${createdCategoryId}`);
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('E2E Category');
  });

  it('deletes the category', async () => {
    const res = await api.delete(`/categories/${createdCategoryId}`);
    expect(res.status).toBe(204);
  });
});

describe('Budget API', () => {
  it('creates a budget', async () => {
    const res = await api.post('/budget', {
      name: 'E2E Budget',
      year: 2026,
      startMonth: '2026-01',
      categories: [],
    });
    expect(res.status).toBe(201);
    expect(res.data.budgetId).toBeDefined();
    createdBudgetId = res.data.budgetId;
  });

  it('lists budgets and includes the created one', async () => {
    const res = await api.get('/budget');
    expect(res.status).toBe(200);
    expect(res.data.some((b: { budgetId: string }) => b.budgetId === createdBudgetId)).toBe(true);
  });

  it('gets the budget by id', async () => {
    const res = await api.get(`/budget/${createdBudgetId}`);
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('E2E Budget');
  });

  it('deletes the budget', async () => {
    const res = await api.delete(`/budget/${createdBudgetId}`);
    expect(res.status).toBe(204);
  });
});

describe('Transactions API', () => {
  let accountId: string;

  beforeAll(async () => {
    // Create a fresh account for transaction tests
    const res = await api.post('/accounts', {
      name: 'E2E Tx Account',
      type: 'checking',
      balance: 500,
      currency: 'EUR',
    });
    accountId = res.data.accountId;
  });

  afterAll(async () => {
    await api.delete(`/accounts/${accountId}`);
  });

  it('creates a transaction', async () => {
    const res = await api.post('/transactions', {
      account: accountId,
      amount: -50,
      description: 'E2E Test Transaction',
      date: '2026-03-08',
      type: 'expense',
    });
    expect(res.status).toBe(201);
    expect(res.data.transactionId).toBeDefined();
    createdTransactionId = res.data.transactionId;
  });

  it('lists transactions for the account', async () => {
    const res = await api.get(`/transactions?account=${accountId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(
      res.data.some((t: { transactionId: string }) => t.transactionId === createdTransactionId),
    ).toBe(true);
  });

  it('gets the transaction by id', async () => {
    const res = await api.get(`/transactions/${createdTransactionId}`);
    expect(res.status).toBe(200);
    expect(res.data.description).toBe('E2E Test Transaction');
  });

  it('deletes the transaction', async () => {
    const res = await api.delete(`/transactions/${createdTransactionId}`);
    expect(res.status).toBe(204);
  });
});
```

**Step 2: Verify the test file has no TypeScript errors**

```bash
npx tsc --noEmit -p apps/backend-e2e/tsconfig.json 2>&1
```
Expected: no errors.

**Step 3: Commit**

```bash
git add apps/backend-e2e/src/backend/backend.spec.ts
git commit -m "feat: write backend-e2e integration tests against live API Gateway"
```

---

## Task 6: Verify Playwright config supports QA API

The `playwright.config.ts` already reads `BASE_URL` from env. In CodeBuild, the `webServer` block will start `vite preview` (because `CI=true`) serving the pre-built frontend. The frontend was built with `VITE_API_ENDPOINT` pointing at QA. No config change is needed.

**Step 1: Confirm the config handles CI mode correctly**

Read `apps/frontend-e2e/playwright.config.ts` and confirm:
- `webServer.command` uses `vite preview` when `CI=true` ✓ (it does, as read above)
- `reuseExistingServer: !process.env['CI']` ✓

No file changes needed. This task is just verification.

**Step 2: Add `test:e2e` and `test:backend-e2e` npm scripts for local convenience**

In `package.json`, add two scripts:
```json
"test:e2e": "npx nx e2e @budget-app/frontend-e2e",
"test:backend-e2e": "npx nx e2e @budget-app/backend-e2e"
```

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add test:e2e and test:backend-e2e npm scripts"
```

---

## Task 7: Clean up `ci.yml`

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Remove the `deploy` and `e2e` jobs entirely**

The new `ci.yml` should contain only `test`, `security-scan`, and `audit` jobs. Also remove `main` from the `push` branches (CodePipeline handles main; GH Actions only needs to run on PRs and develop). Or keep `main` push for fast unit test feedback — your choice. The important thing is removing `deploy`.

Replace the entire file with:

```yaml
name: CI

on:
  push:
    branches: [ develop ]
  pull_request:
    branches: [ main, develop ]

env:
  NODE_VERSION: '24'

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v5
      with:
        fetch-depth: 0

    - uses: actions/setup-node@v5
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - run: npm ci
    - run: npm run lint
    - run: npm run test:frontend
    - run: npm run test:backend
    - run: npm run build
    - run: npm run build:backend

  security-scan:
    runs-on: ubuntu-latest
    needs: test

    steps:
    - uses: actions/checkout@v5

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy results to GitHub Security tab
      uses: github/codeql-action/upload-sarif@v3
      if: always()
      continue-on-error: true
      with:
        sarif_file: 'trivy-results.sarif'

  audit:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v5

    - uses: actions/setup-node@v5
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - run: npm ci
    - run: npm audit --audit-level=high
      continue-on-error: true

    - run: npx audit-ci --config ./audit-ci.json || echo "No audit-ci config found, skipping"
```

**Step 2: Remove AWS secrets from GitHub repo settings**

After verifying the pipeline is live (Task 8), manually delete from GitHub → Settings → Secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET`
- `CLOUDFRONT_DIST_ID`

(Do this after the first successful pipeline run, not before.)

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: remove deploy and e2e jobs; deployment now handled by AWS CodePipeline"
```

---

## Task 8: Initial pipeline bootstrap and deploy

**Step 1: Fill in the placeholders in `pipeline-stack.ts`**

In `apps/backend/src/pipeline-stack.ts`, replace:
- `REPLACE_WITH_CONNECTION_ARN` → your actual CodeStar ARN
- `REPLACE_WITH_GITHUB_OWNER/REPO` → e.g. `matteo/family-budget`

**Step 2: Synth to validate**

```bash
npm run cdk:synth
```
Expected: `BudgetPipelineStack` template generated in `cdk.out/` with no errors.

**Step 3: Deploy the pipeline stack (one-time manual deploy)**

```bash
npm run cdk:deploy -- BudgetPipelineStack --require-approval never
```
Expected: Stack deploys. CodePipeline is created in AWS console. The pipeline immediately starts its first run.

**Step 4: Monitor first pipeline run**

In AWS Console → CodePipeline → `BudgetAppPipeline`:
1. **Source** → pulls from GitHub ✓
2. **Build/Synth** → runs `npm ci && build:backend && cdk synth` ✓
3. **UpdatePipeline** → self-mutation step applies any pipeline definition changes ✓
4. **QA/Deploy** → deploys `BudgetAppBackendStack` with `-QA` suffix tables ✓
5. **QA/BackendE2E** → runs integration tests against QA API GW ✓
6. **QA/PlaywrightE2E** → builds frontend with QA URL, runs Playwright ✓
7. **Prod/Deploy** → deploys all three prod stacks ✓

**Step 5: Verify QA tables exist in DynamoDB**

AWS Console → DynamoDB → Tables. You should see:
- `BankAccounts-QA`
- `BankTransactions-QA`
- `Categories-QA`
- `BudgetPlanner-QA`

And the original prod tables untouched:
- `BankAccounts`
- `BankTransactions`
- `Categories`
- `BudgetPlanner`

**Step 6: Remove AWS credentials from GitHub** (now safe to do)

GitHub repo → Settings → Secrets → delete the 5 AWS secrets listed in Task 7.

---

## Checklist

- [ ] Task 1: `BackendStack` accepts `stackEnv`, suffixes table names, exposes `apiUrlOutput`
- [ ] Task 2: `BudgetAppStage` created, QA deploys backend only, prod deploys all three stacks
- [ ] Task 3: `BudgetPipelineStack` created with QA gate (BackendE2E + PlaywrightE2E post-steps)
- [ ] Task 4: `main.ts` updated to instantiate only `BudgetPipelineStack`
- [ ] Task 5: Backend-e2e tests cover full CRUD for accounts, categories, budget, transactions
- [ ] Task 6: `test:e2e` and `test:backend-e2e` scripts added to `package.json`
- [ ] Task 7: `ci.yml` stripped of deploy/e2e jobs and AWS secrets
- [ ] Task 8: Pipeline deployed, first run succeeds, QA tables visible in DynamoDB
