# Frontend E2E: Cypress → Playwright Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Cypress setup in `apps/frontend-e2e` with Playwright, keeping the same Nx integration and adding meaningful e2e test coverage for the app's main routes.

**Architecture:** Drop all Cypress files and config; install `@playwright/test` + `@nx/playwright`; reconfigure the Nx project with a `playwright.config.ts`; translate existing test structure to Playwright page-object style. The `@nx/playwright/plugin` in `nx.json` auto-discovers the config and wires up the `e2e` target.

**Tech Stack:** `@playwright/test`, `@nx/playwright@21.x`, TypeScript, Vite (frontend dev server)

---

## Task 1: Install Playwright packages

**Files:**
- Modify: `package.json` (root)

**Step 1: Install packages**

```bash
npm install --save-dev @playwright/test @nx/playwright
```

**Step 2: Install Playwright browser binaries**

```bash
npx playwright install --with-deps chromium
```

**Step 3: Verify install**

```bash
npx playwright --version
```

Expected: prints `Version X.Y.Z`

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @playwright/test and @nx/playwright dependencies"
```

---

## Task 2: Remove Cypress files from `apps/frontend-e2e`

**Files:**
- Delete: `apps/frontend-e2e/cypress.config.ts`
- Delete: `apps/frontend-e2e/src/e2e/app.cy.ts`
- Delete: `apps/frontend-e2e/src/support/commands.ts`
- Delete: `apps/frontend-e2e/src/support/e2e.ts`
- Delete: `apps/frontend-e2e/src/support/app.po.ts`
- Delete: `apps/frontend-e2e/src/fixtures/example.json`
- Delete entire dir: `apps/frontend-e2e/src/support/`
- Delete entire dir: `apps/frontend-e2e/src/e2e/`
- Delete entire dir: `apps/frontend-e2e/src/fixtures/`

**Step 1: Delete Cypress source files**

```bash
rm -rf apps/frontend-e2e/cypress.config.ts \
       apps/frontend-e2e/src/e2e \
       apps/frontend-e2e/src/support \
       apps/frontend-e2e/src/fixtures
```

**Step 2: Verify only non-Cypress files remain**

```bash
find apps/frontend-e2e -type f | sort
```

Expected: only `package.json`, `tsconfig.json`, `eslint.config.mjs` remain (no `.cy.ts` files).

**Step 3: Commit**

```bash
git add -A apps/frontend-e2e
git commit -m "chore: remove cypress config and test files from frontend-e2e"
```

---

## Task 3: Create Playwright config

**Files:**
- Create: `apps/frontend-e2e/playwright.config.ts`

**Step 1: Create the config**

```typescript
// apps/frontend-e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] ?? 'http://localhost:4200';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx nx run @budget-app/frontend:serve',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    cwd: workspaceRoot,
  },
});
```

**Step 2: Verify the file exists**

```bash
cat apps/frontend-e2e/playwright.config.ts
```

**Step 3: Commit**

```bash
git add apps/frontend-e2e/playwright.config.ts
git commit -m "feat: add playwright.config.ts for frontend-e2e"
```

---

## Task 4: Update `tsconfig.json` in `apps/frontend-e2e`

The current tsconfig references `"types": ["cypress", "node"]` and includes `*.cy.ts` patterns. Replace with Playwright-appropriate settings.

**Files:**
- Modify: `apps/frontend-e2e/tsconfig.json`

**Step 1: Rewrite tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "out-tsc/playwright",
    "allowJs": true,
    "types": ["node"],
    "sourceMap": false
  },
  "include": [
    "**/*.ts",
    "**/*.js",
    "playwright.config.ts",
    "**/*.spec.ts",
    "**/*.d.ts"
  ],
  "exclude": [
    "out-tsc",
    "test-output",
    "eslint.config.js",
    "eslint.config.cjs",
    "eslint.config.mjs"
  ]
}
```

**Step 2: Commit**

```bash
git add apps/frontend-e2e/tsconfig.json
git commit -m "chore: update frontend-e2e tsconfig for playwright"
```

---

## Task 5: Update `eslint.config.mjs` in `apps/frontend-e2e`

Remove the `eslint-plugin-cypress/flat` import; use only the base Nx config.

**Files:**
- Modify: `apps/frontend-e2e/eslint.config.mjs`

**Step 1: Rewrite eslint.config.mjs**

```js
// apps/frontend-e2e/eslint.config.mjs
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // Override or add rules here
    rules: {},
  },
];
```

**Step 2: Commit**

```bash
git add apps/frontend-e2e/eslint.config.mjs
git commit -m "chore: remove cypress eslint plugin from frontend-e2e"
```

---

## Task 6: Update `nx.json` — replace Cypress plugin with Playwright plugin

**Files:**
- Modify: `nx.json`

**Step 1: In `nx.json`, replace the `@nx/cypress/plugin` entry**

Find and remove this block:
```json
{
  "plugin": "@nx/cypress/plugin",
  "options": {
    "targetName": "e2e",
    "openTargetName": "open-cypress",
    "componentTestingTargetName": "component-test",
    "ciTargetName": "e2e-ci"
  }
}
```

Add in its place:
```json
{
  "plugin": "@nx/playwright/plugin",
  "options": {
    "targetName": "e2e",
    "ciTargetName": "e2e-ci"
  }
}
```

**Step 2: In `namedInputs.production`, replace the Cypress exclusion patterns**

Remove:
```json
"!{projectRoot}/cypress/**/*",
"!{projectRoot}/**/*.cy.[jt]s?(x)",
"!{projectRoot}/cypress.config.[jt]s",
```

Add:
```json
"!{projectRoot}/**/*.spec.[jt]s?(x)",
"!{projectRoot}/playwright.config.[jt]s",
```

**Step 3: Verify Nx can parse the config**

```bash
npx nx show project @budget-app/frontend-e2e
```

Expected: shows an `e2e` target powered by `@nx/playwright/plugin`.

**Step 4: Commit**

```bash
git add nx.json
git commit -m "chore: swap @nx/cypress/plugin for @nx/playwright/plugin in nx.json"
```

---

## Task 7: Create page objects

Page objects centralise selectors and keep tests readable. Create one file that covers the app's navigation and key pages.

**Files:**
- Create: `apps/frontend-e2e/src/pages/navigation.page.ts`

**Step 1: Create the page object**

```typescript
// apps/frontend-e2e/src/pages/navigation.page.ts
import { Page, Locator } from '@playwright/test';

export class NavigationPage {
  readonly page: Page;
  readonly appTitle: Locator;
  readonly dashboardLink: Locator;
  readonly accountsLink: Locator;
  readonly categoriesLink: Locator;
  readonly budgetLink: Locator;
  readonly transactionsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.appTitle = page.getByRole('link', { name: /Budget App/i });
    this.dashboardLink = page.getByRole('link', { name: /Dashboard/i });
    this.accountsLink = page.getByRole('link', { name: /Bank Accounts/i });
    this.categoriesLink = page.getByRole('link', { name: /Categories/i });
    this.budgetLink = page.getByRole('link', { name: /Budget/i });
    this.transactionsLink = page.getByRole('link', { name: /Transactions/i });
  }

  async goto() {
    await this.page.goto('/');
  }
}
```

**Step 2: Commit**

```bash
git add apps/frontend-e2e/src/pages/navigation.page.ts
git commit -m "feat: add NavigationPage page object for playwright e2e"
```

---

## Task 8: Write failing navigation tests

**Files:**
- Create: `apps/frontend-e2e/src/navigation.spec.ts`

**Step 1: Write the test**

```typescript
// apps/frontend-e2e/src/navigation.spec.ts
import { test, expect } from '@playwright/test';
import { NavigationPage } from './pages/navigation.page';

test.describe('Navigation', () => {
  test('shows app title in nav bar', async ({ page }) => {
    const nav = new NavigationPage(page);
    await nav.goto();
    await expect(nav.appTitle).toBeVisible();
  });

  test('navigates to Bank Accounts page', async ({ page }) => {
    const nav = new NavigationPage(page);
    await nav.goto();
    await nav.accountsLink.click();
    await expect(page).toHaveURL(/\/accounts/);
  });

  test('navigates to Categories page', async ({ page }) => {
    const nav = new NavigationPage(page);
    await nav.goto();
    await nav.categoriesLink.click();
    await expect(page).toHaveURL(/\/categories/);
  });

  test('navigates to Budget page', async ({ page }) => {
    const nav = new NavigationPage(page);
    await nav.goto();
    await nav.budgetLink.click();
    await expect(page).toHaveURL(/\/budget/);
  });

  test('navigates to Transactions page', async ({ page }) => {
    const nav = new NavigationPage(page);
    await nav.goto();
    await nav.transactionsLink.click();
    await expect(page).toHaveURL(/\/transactions/);
  });

  test('app title navigates back to dashboard', async ({ page }) => {
    const nav = new NavigationPage(page);
    await nav.goto();
    await nav.accountsLink.click();
    await nav.appTitle.click();
    await expect(page).toHaveURL('/');
  });
});
```

**Step 2: Run the tests and expect them to fail (frontend not started yet)**

```bash
BASE_URL=http://localhost:4200 npx playwright test apps/frontend-e2e/src/navigation.spec.ts --project=chromium 2>&1 | head -20
```

Expected: FAIL — connection refused or similar (frontend isn't running; that's fine at this stage).

**Step 3: Commit**

```bash
git add apps/frontend-e2e/src/navigation.spec.ts
git commit -m "test: add playwright navigation e2e tests (failing)"
```

---

## Task 9: Run e2e tests end-to-end via Nx (boots frontend automatically)

**Step 1: Run via Nx (starts the frontend dev server automatically)**

```bash
npx nx e2e @budget-app/frontend-e2e
```

Expected: Playwright starts the frontend via the `webServer` config, then all 6 navigation tests PASS.

> If the frontend fails to start, check that `npm run serve` works first: `npm run serve`

**Step 2: Run just chromium in headed mode to visually verify**

```bash
npx nx e2e @budget-app/frontend-e2e -- --project=chromium --headed
```

**Step 3: Commit**

```bash
git add -A
git commit -m "test: playwright e2e navigation tests passing"
```

---

## Task 10: Update CLAUDE.md for `apps/frontend-e2e`

**Files:**
- Modify: `apps/frontend-e2e/CLAUDE.md`

**Step 1: Rewrite the file**

```markdown
# Frontend E2E Tests

Playwright end-to-end tests for the `apps/frontend` React application.

## Stack

- **Framework**: Playwright (`@playwright/test`)
- **Nx integration**: `@nx/playwright`
- **Browser**: Chromium (default)

## Commands

```bash
# Run all e2e tests (starts frontend dev server automatically)
npx nx e2e @budget-app/frontend-e2e

# Run in headed mode (see browser)
npx nx e2e @budget-app/frontend-e2e -- --headed

# Run a single spec
npx nx e2e @budget-app/frontend-e2e -- --grep "Navigation"

# Open Playwright UI
npx nx e2e @budget-app/frontend-e2e -- --ui
```

The `playwright.config.ts` `webServer` block auto-starts the frontend at `http://localhost:4200`
before running tests. Set `BASE_URL` env var to override.

## Source Layout

```
src/
  pages/
    navigation.page.ts   # NavigationPage page object (nav bar selectors)
  navigation.spec.ts     # Navigation link tests
```

## Writing Tests

- Place test files under `src/` with the `.spec.ts` extension.
- Use page objects in `src/pages/` for element selectors — keep locators out of test files.
- Use `page.route()` / `page.routeFromHAR()` to stub API calls so tests don't require a live backend.

## CI

Set `CI=true` so Playwright does not reuse an existing dev server. The `webServer` command
starts the preview server at the configured `BASE_URL`.
```

**Step 2: Commit**

```bash
git add apps/frontend-e2e/CLAUDE.md
git commit -m "docs: update frontend-e2e CLAUDE.md for playwright"
```

---

## Done

Verify the full picture:

```bash
npx nx show project @budget-app/frontend-e2e   # shows e2e target via @nx/playwright/plugin
npx nx e2e @budget-app/frontend-e2e            # all tests green
npx nx lint @budget-app/frontend-e2e           # no lint errors
```
