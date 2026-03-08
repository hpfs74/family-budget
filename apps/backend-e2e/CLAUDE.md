# Backend E2E Tests

Integration/end-to-end tests for the backend Lambda handlers.

## Stack

- **Framework**: Jest
- **Nx integration**: `@nx/jest`
- **Depends on**: `@budget-app/backend` (must be built and served before running)

## Commands

```bash
npx nx e2e @budget-app/backend-e2e
```

The e2e target depends on `@budget-app/backend:build` and `@budget-app/backend:serve`.

## Source Layout

```
src/
  backend/
    backend.spec.ts    # Integration test suite
  test-setup.ts        # Jest global setup
```

## Notes

Currently the test suite is a placeholder. Tests should target a locally running or deployed API Gateway endpoint and cover full request/response cycles for each Lambda handler.
