# Frontend E2E Tests

Cypress end-to-end tests for the `apps/frontend` React application.

## Stack

- **Framework**: Cypress with Vite bundler
- **Nx integration**: `@nx/cypress`

## Commands

```bash
# Run e2e tests (starts frontend dev server automatically)
npx nx e2e @budget-app/frontend-e2e

# Open Cypress interactive runner
npx nx e2e @budget-app/frontend-e2e --watch
```

The Cypress config (`cypress.config.ts`) auto-starts the frontend at `http://localhost:4200` before running tests.

## Source Layout

```
src/
  e2e/
    app.cy.ts            # Main e2e test suite
  support/
    app.po.ts            # Page object helpers (selectors)
    commands.ts          # Custom Cypress commands (e.g. cy.login)
    e2e.ts               # Global Cypress setup (imported before each spec)
  fixtures/
    example.json         # Static fixture data for stubbing
```

## Writing Tests

- Place test files under `src/e2e/` with the `.cy.ts` extension.
- Use page object helpers in `src/support/app.po.ts` for element selectors — keep selectors out of test files.
- Use `cy.intercept()` to stub API calls so tests don't require a live backend.

## CI

The CI web server command uses `npx nx run @budget-app/frontend:preview` at base URL `http://localhost:4300`.
