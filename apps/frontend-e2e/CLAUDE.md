# Frontend E2E Tests

Playwright end-to-end tests for the `apps/frontend` React application.

## Stack

- **Framework**: `@playwright/test` (Playwright)
- **Nx integration**: `@nx/playwright`
- **Browser**: Chromium

## Commands

```bash
# Run all e2e tests (starts frontend dev server automatically)
npx nx e2e @budget-app/frontend-e2e

# Run in headed mode (see the browser)
npx nx e2e @budget-app/frontend-e2e -- --headed

# Run a single spec file
npx nx e2e @budget-app/frontend-e2e -- --grep "Navigation"

# Open Playwright interactive UI
npx nx e2e @budget-app/frontend-e2e -- --ui
```

The `webServer` block in `playwright.config.ts` auto-starts the frontend dev server at
`http://localhost:4200` before running tests. Override the URL via the `BASE_URL` env var.

## Source Layout

```
src/
  pages/
    navigation.page.ts   # NavigationPage — nav bar locators and goto()
  navigation.spec.ts     # 6 navigation tests (route links + app title)
```

## Writing Tests

- Place test files under `src/` with the `.spec.ts` extension.
- Add page objects under `src/pages/` — keep locators out of test files.
- Use `page.route()` or `page.routeFromHAR()` to stub API calls so tests work without a live backend.
- Prefer `getByRole` and `getByText` locators over CSS selectors.

## CI

Set `CI=true` so Playwright always starts a fresh dev server (disables `reuseExistingServer`).
The `e2e-ci` Nx target is also available for sharded/parallelised CI runs.
