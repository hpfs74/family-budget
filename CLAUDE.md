# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

Nx monorepo with four projects:

| Project          | Location             | Details                                                      |
|------------------|----------------------|--------------------------------------------------------------|
| `frontend`       | `apps/frontend/`     | React 19 + Vite SPA → [CLAUDE.md](apps/frontend/CLAUDE.md)  |
| `frontend-e2e`   | `apps/frontend-e2e/` | Playwright e2e tests → [CLAUDE.md](apps/frontend-e2e/CLAUDE.md) |
| `backend`        | `apps/backend/`      | AWS CDK + Lambda + DynamoDB → [CLAUDE.md](apps/backend/CLAUDE.md) |
| `backend-e2e`    | `apps/backend-e2e/`  | Backend integration tests → [CLAUDE.md](apps/backend-e2e/CLAUDE.md) |

## Essential Commands

```bash
# Install dependencies (uses npm — do NOT commit pnpm-lock.yaml)
npm install

# Frontend
npm run serve                 # React dev server at http://localhost:4200
npm run build                 # Production build → apps/frontend/dist/

# Testing
npm test                      # All tests
npm run test:frontend         # Frontend unit tests (Jest)
npm run test:backend          # Backend unit tests (Jest)

# Linting
npm run lint                  # All projects

# CDK (local inspection only — do NOT deploy manually, use pipeline)
npm run cdk:synth             # Generate CloudFormation templates
npm run cdk:diff              # Preview infrastructure changes vs deployed stack
```

## Deployment Pipeline

**Do not run `cdk deploy` or push directly to AWS manually.**  
All deployments go through the automated pipeline:

```
git push main → GitHub Actions (tests) → AWS CodePipeline (QA → Prod)
```

1. **GitHub Actions** (`.github/workflows/ci.yml`): lint, unit tests, build, then triggers CodePipeline
2. **AWS CodePipeline** (`BudgetAppPipeline`, eu-south-1): build → QA deploy → backend e2e + Playwright e2e → Prod deploy

## Live Endpoints

| Environment | API Gateway | Frontend |
|-------------|-------------|----------|
| Prod | `https://h8fa6e1e14.execute-api.eu-south-1.amazonaws.com/prod/` | `https://budget.matteo.cool` |
| QA   | `https://kp2htdjdv0.execute-api.eu-south-1.amazonaws.com/prod`  | — |

CloudFront (`EXD3ZGZOOAB7D`) proxies `/api/*` → Prod API Gateway (strips `/api` prefix via CloudFront Function).

## AWS Profile & Region

- AWS profile: `hpfs`
- Primary region: `eu-south-1` (Milan)
- Certificate stack region: `us-east-1` (required for CloudFront)

## Important Notes

- **pnpm-lock.yaml is gitignored** — the project uses npm (`package-lock.json`). Nx detects pnpm if `pnpm-lock.yaml` is committed and breaks CI.
- **depsLockFilePath** in CDK Lambda bundling must be `'package-lock.json'` (not pnpm).
- **esbuild**: if bundling fails locally, copy the esbuild binary from `.pnpm/` store to `node_modules/esbuild/bin/esbuild`.

## CDK Rules

- `pointInTimeRecovery: true` is deprecated. Use:
  ```typescript
  pointInTimeRecoverySpecification: {
    pointInTimeRecoveryEnabled: true,
  }
  ```
