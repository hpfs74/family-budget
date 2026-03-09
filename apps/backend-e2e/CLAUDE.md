# Backend E2E Tests

Integration tests for the backend API — runs against a live deployed API Gateway endpoint.

## Stack

- **Framework**: Jest + Axios
- **Target**: deployed API Gateway (QA or Prod)
- **Nx integration**: `@nx/jest`

## Commands

```bash
# Run against QA (used by AWS CodePipeline)
API_BASE_URL=https://kp2htdjdv0.execute-api.eu-south-1.amazonaws.com/prod npx nx e2e @budget-app/backend-e2e

# Run against Prod
API_BASE_URL=https://h8fa6e1e14.execute-api.eu-south-1.amazonaws.com/prod npx nx e2e @budget-app/backend-e2e
```

## Source Layout

```
src/
  backend/
    backend.spec.ts    # Full CRUD integration tests for all resources
  test-setup.ts        # Jest global setup
```

## Test Coverage

Each resource is tested end-to-end with full lifecycle (create → list → get → update → delete):

| Suite              | Tests                                                   |
|--------------------|---------------------------------------------------------|
| Accounts API       | create, list (includes created), get, update, delete    |
| Categories API     | create, list (includes created), get, update, delete    |
| Budget API         | create, list, get, update, delete (with temp category)  |
| Transactions API   | create, list for account, get by id, delete             |

## Important API Conventions

- `GET /accounts` returns `{ accounts: [], count: 0 }` — extract `.accounts`
- `GET /categories` returns `{ categories: [], count: 0 }` — extract `.categories`
- `GET /budget` returns `{ items: [], count: 0 }` — extract `.items`
- `GET /transactions?account={id}` returns `{ transactions: [] }` — extract `.transactions`
- `GET /transactions/{id}` and `DELETE /transactions/{id}` **require** `?account={accountId}` query param
- `PATCH /transactions/bulk` payload: `{ account, transactionIds: string[], updates: {} }`

## CI Usage

In `BudgetPipelineStack`, the `BackendE2E` CodeBuild action runs these tests against the QA stack before promoting to Prod. The `API_BASE_URL` env var is set automatically by the pipeline to the QA API Gateway URL.
