# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

Nx monorepo with four projects:

| Project          | Location          | Details                                              |
|------------------|-------------------|------------------------------------------------------|
| `frontend`       | `apps/frontend/`  | React 19 + Vite SPA → [CLAUDE.md](apps/frontend/CLAUDE.md) |
| `frontend-e2e`   | `apps/frontend-e2e/` | Cypress e2e tests → [CLAUDE.md](apps/frontend-e2e/CLAUDE.md) |
| `backend`        | `backend/`        | AWS CDK + Lambda + DynamoDB → [CLAUDE.md](backend/CLAUDE.md) |
| `backend-e2e`    | `backend-e2e/`    | Backend integration tests → [CLAUDE.md](backend-e2e/CLAUDE.md) |

## Essential Commands

```bash
# Install dependencies
npm install

# Frontend
npm run serve                 # React dev server at http://localhost:4200
npm run build                 # Production build → apps/frontend/dist/

# Backend / Infrastructure
npm run cdk:bootstrap         # Bootstrap CDK (first time only)
npm run cdk:synth             # Generate CloudFormation templates
npm run cdk:diff              # Preview infrastructure changes
npm run cdk:deploy            # Deploy to AWS
npm run cdk:destroy           # Destroy AWS resources

# Testing
npm test                      # All tests
npm run test:frontend         # Frontend unit tests (Jest)
npm run test:backend          # Backend unit tests (Jest)

# Linting
npm run lint                  # All projects
npm run lint:frontend         # Frontend only
npm run lint:backend          # Backend only
```

## CDK Rules

- `pointInTimeRecovery: true` is deprecated. Use:
  ```typescript
  pointInTimeRecoverySpecification: {
    pointInTimeRecoveryEnabled: true,
  }
  ```
