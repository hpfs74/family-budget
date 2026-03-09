# Frontend App

React 19 + Vite + TypeScript single-page application for the family budget tracker.

## Stack

- **Framework**: React 19 with TypeScript
- **Bundler**: Vite
- **Routing**: React Router DOM v7
- **Styling**: Tailwind CSS + CSS variables (dark mode)
- **HTTP**: native `fetch`
- **Testing**: Jest + React Testing Library (unit), Playwright (e2e via `apps/frontend-e2e`)

## Commands

```bash
npm run serve            # Dev server at http://localhost:4200
npm run build            # Production build → apps/frontend/dist/
npm run test:frontend    # Jest unit tests
npm run lint:frontend    # ESLint
```

## Source Layout

```
src/
  main.tsx               # React entry point, BrowserRouter setup
  styles.css             # Global styles + CSS variables for theming
  app/
    app.tsx              # Route definitions
  hooks/
    useTheme.ts          # Dark/light mode hook (localStorage + OS preference)
  components/
    Navigation.tsx        # Top nav bar with route links + dark mode toggle (☀️/🌙)
    Dashboard.tsx         # Summary overview of accounts & recent transactions
    BankAccounts.tsx      # Full CRUD for bank accounts
    Transactions.tsx      # Transaction list with filtering, CSV import, bulk category update
    Categories.tsx        # Category management (name + color)
    Budget.tsx            # Budget planner (3 tabs: Piano, Confronto, Grafico)
    ConfirmationModal.tsx # Reusable delete-confirmation dialog
    TransactionModal.tsx  # Create/edit transaction form
    TransferModal.tsx     # Inter-account transfer form
    Snackbar.tsx          # Toast notification component
    DateTime.tsx          # Server time display (debug utility)
```

## Routes

| Path            | Component    | Description                                  |
|-----------------|--------------|----------------------------------------------|
| `/`             | Dashboard    | Summary cards and recent activity            |
| `/accounts`     | BankAccounts | CRUD bank accounts                           |
| `/categories`   | Categories   | CRUD spending categories                     |
| `/budget`       | Budget       | Budget planner + comparison + annual chart   |
| `/transactions` | Transactions | Transaction list + CSV import + bulk edit    |

## Environment Variables

```env
VITE_API_ENDPOINT=https://<api-gateway-url>/   # Local dev — points to deployed API
```

In **production**, `VITE_API_ENDPOINT=/api/` so requests go through CloudFront (`/api/*` → API Gateway).  
Set in `.env.local` for local development. Consumed via `import.meta.env.VITE_API_ENDPOINT`.

## Dark Mode

Implemented via CSS variables + `data-theme` attribute on `<html>`:

```css
/* styles.css */
:root { --bg-primary: #fff; --text-primary: #111; ... }
[data-theme="dark"] { --bg-primary: #0f172a; --text-primary: #f1f5f9; ... }
```

`useTheme` hook (`src/hooks/useTheme.ts`):
- Reads/writes `localStorage.theme`
- Falls back to `prefers-color-scheme` on first visit
- Sets `document.documentElement.setAttribute("data-theme", theme)`

Components apply theme via `style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}` alongside Tailwind classes.

## Budget Component (3 tabs)

1. **Piano Budget** — list/add/edit budget items. Each item has:
   - `type`: `monthly` (full year) | `periodic` (custom start/end) | `one-time`
   - `direction`: `expense` (↓ red) | `income` (↑ green)
2. **Confronto Mensile** — planned vs actual by category for a selected month. Shows separate expense and income cards.
3. **Grafico Annuale** — pure SVG bar chart, 12 months, two bars per month (Previsto / Reale). No external chart library.

## Transactions — Bulk Category Update

When editing a transaction and checking "aggiorna tutte le transazioni simili":
1. Finds all transactions with the same `description` + `account` in the loaded list
2. Calls `PATCH /transactions/bulk` with `{ account, transactionIds, updates: { category } }`

## Testing

Unit tests live alongside source files as `*.spec.tsx`. All components using `import.meta.env` or complex hooks must be mocked in `app.spec.tsx`.

```tsx
// app.spec.tsx pattern for components using import.meta
jest.mock('../components/Budget', () => ({
  Budget: () => <div data-testid="budget">Mocked Budget</div>
}));
```
