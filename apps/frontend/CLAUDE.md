# Frontend App

React 19 + Vite + TypeScript single-page application for the family budget tracker.

## Stack

- **Framework**: React 19 with TypeScript
- **Bundler**: Vite
- **Routing**: React Router DOM v7
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **HTTP**: Axios
- **Testing**: Jest + React Testing Library (unit), Cypress (e2e via `apps/frontend-e2e`)

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
  app/
    app.tsx              # Route definitions
  components/
    Navigation.tsx        # Top nav bar with route links
    Dashboard.tsx         # Summary overview of accounts & budget
    BankAccounts.tsx      # Full CRUD for bank accounts
    Transactions.tsx      # Transaction list with filtering & CSV import
    Categories.tsx        # Category management
    Budget.tsx            # Budget planner with actual vs planned comparison
    ConfirmationModal.tsx # Reusable delete-confirmation dialog
    TransactionModal.tsx  # Create/edit transaction form
    TransferModal.tsx     # Inter-account transfer form
    Snackbar.tsx          # Toast notification component
    DateTime.tsx          # Server time display (debug utility)
```

## Routes

| Path            | Component       | Description                       |
|-----------------|-----------------|-----------------------------------|
| `/`             | Dashboard       | Summary cards and recent activity |
| `/accounts`     | BankAccounts    | CRUD bank accounts                |
| `/categories`   | Categories      | CRUD spending categories          |
| `/budget`       | Budget          | Budget planner + comparison       |
| `/transactions` | Transactions    | Transaction list + CSV import     |

## Environment Variables

```env
VITE_API_ENDPOINT=https://<api-gateway-url>   # Required — points to deployed API
```

Set in `.env.local` for local development. The variable is consumed via `import.meta.env.VITE_API_ENDPOINT`.

## API Communication

All API calls go through plain `fetch`/`axios` calls in each component. There is no shared API client layer — each component constructs requests using the `VITE_API_ENDPOINT` base URL.

## Testing

Unit tests live alongside source files as `*.spec.tsx` files and use Jest + React Testing Library. Run with:

```bash
npm run test:frontend
```

End-to-end tests use Cypress — see [apps/frontend-e2e/CLAUDE.md](../frontend-e2e/CLAUDE.md).
