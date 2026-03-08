# CI/CD Refactor Design

**Date:** 2026-03-08
**Status:** Approved

## Goal

Move deployment from GitHub Actions to AWS CodePipeline to eliminate AWS credentials in GitHub, create a QA staging environment, and gate production deployments behind passing e2e tests on real AWS infrastructure.

## Architecture

```
GitHub (main branch)
    │
    └── CodeStar Connection (OAuth, no tokens)
            │
            ▼
    AWS CodePipeline (BudgetPipelineStack, eu-south-1)
            │
    ┌───────▼────────┐
    │  Source Stage  │  pulls code via CodeStar Connection
    └───────┬────────┘
            │
    ┌───────▼────────┐
    │  Build Stage   │  CodeBuild: npm install, cdk synth, build Lambda
    └───────┬────────┘
            │
    ┌───────▼────────────────────────────────┐
    │  QA Stage                              │
    │  ├── Deploy BudgetAppBackendStack-QA   │
    │  ├── Run backend-e2e (CodeBuild)       │
    │  └── Run Playwright (CodeBuild)        │
    └───────┬────────────────────────────────┘
            │  pipeline stops here on failure — prod untouched
    ┌───────▼────────────────────────────────┐
    │  Prod Stage                            │
    │  ├── Deploy BudgetAppBackendStack      │
    │  ├── Deploy BudgetCertificateStack     │
    │  └── Deploy BudgetFrontendStack        │
    └────────────────────────────────────────┘
```

## CDK Changes

### New: `apps/backend/src/pipeline-stack.ts`

`BudgetPipelineStack` using `aws-cdk-lib/pipelines` (`CodePipeline` construct, self-mutating). Responsibilities:
- CodeStar connection to GitHub
- S3 artifact bucket
- CodeBuild projects: synth, backend-e2e, playwright
- QA stage → Prod stage wave definitions

### Modified: `apps/backend/src/main.ts`

Instantiate `BudgetPipelineStack` instead of the three app stacks directly. The pipeline owns deployment of all other stacks.

### Modified: `apps/backend/src/backend-stack.ts`

Accept an `env` prop (`'prod' | 'qa'`) to namespace all resource names:
- Stack ID: `BudgetAppBackendStack-QA` vs `BudgetAppBackendStack`
- DynamoDB tables: `BankAccounts-QA`, `BankTransactions-QA`, `Categories-QA`, `BudgetPlanner-QA`
- API GW: separate URL output per environment
- Lambda env vars: already injected dynamically, no Lambda code changes needed

The QA stack is an identical instantiation of the same construct — no logic duplication.

## QA E2E Testing

### Step 1: backend-e2e (CodeBuild)

- Runs after `BudgetAppBackendStack-QA` is deployed
- QA API GW URL passed as `API_BASE_URL` via CDK stack output → CodePipeline env var
- Command: `npm run test:backend-e2e`
- Failure stops the pipeline before prod deployment

### Step 2: Playwright (CodeBuild, sequential after Step 1)

- Same `API_BASE_URL` injected into Playwright config
- Tests hit QA API GW directly (no frontend deployment required)
- Command: `npm run test:e2e`
- HTML report artifacts uploaded to S3

### CodeBuild environment (both steps)

- Image: `aws/codebuild/standard:7.0`
- IAM role with permissions scoped to QA resources only
- Test reports published to CodeBuild Reports console

### Value

QA tests validate real data persistence, DynamoDB GSI queries, and API GW routing — not mocks.

## GitHub Actions Cleanup

### Keep unchanged

- `secrets-scan.yml` (TruffleHog, GitLeaks, Semgrep, OWASP)
- Dependabot

### Modify `ci.yml`

**Remove:**
- `deploy` job (entire block)
- `e2e` job (superseded by CodePipeline QA stage)
- Secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`, `CLOUDFRONT_DIST_ID`

**Keep:**
- `test` job — lint, unit tests, build
- `security-scan` job — Trivy filesystem scan
- `audit` job — npm audit

### GitHub secrets after cleanup

**Remove:** all AWS credentials
**Keep:** `GITLEAKS_LICENSE`, `SEMGREP_APP_TOKEN`, `NVDAPI_KEY`, `OSS_INDEX_USER`, `OSS_INDEX_TOKEN`

## Bootstrap

The `BudgetPipelineStack` is deployed once manually:

```bash
npm run cdk:deploy -- BudgetPipelineStack
```

After that, all future deployments are triggered by pushing to `main`. The pipeline self-mutates when CDK stack definitions change.

## Security Properties

- No AWS credentials stored in GitHub
- Least-privilege IAM roles per CodeBuild project
- QA resources are fully isolated from prod (separate table names, separate stack)
- Pipeline role scoped to deploy only the defined stacks
