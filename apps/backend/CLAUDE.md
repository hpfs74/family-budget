# Backend App

AWS CDK v2 infrastructure and per-operation Lambda handlers for the family budget API.

## Stack

- **Infrastructure**: AWS CDK v2 (TypeScript)
- **Lambda runtime**: Node.js 18.x via `aws-cdk-lib/aws-lambda-nodejs` (esbuild bundling)
- **Database**: DynamoDB (pay-per-request, PITR enabled)
- **Validation**: Zod
- **Observability**: AWS X-Ray tracing + `lambda-log`
- **Testing**: Jest + `aws-sdk-client-mock`

## Commands

```bash
npm run test:backend     # Run all 88 backend unit tests
npm run build:backend    # Compile TypeScript
npm run lint:backend     # Lint
npx cdk synth            # Generate CloudFormation templates (cdk.out/)
npx cdk diff             # Preview infrastructure changes vs deployed stack
npx cdk deploy           # Deploy all stacks to AWS
npx cdk destroy          # Destroy deployed stacks
npx cdk bootstrap        # One-time CDK bootstrap (first deploy only)
```

## Source Layout

```
apps/backend/src/
  main.ts                    # CDK app entry point — instantiates all stacks
  backend-stack.ts           # 25 NodejsFunction constructs, one per operation
  certificate-stack.ts       # ACM certificate (us-east-1, for CloudFront)
  frontend-stack.ts          # S3 + CloudFront + Route 53 for the React SPA
  shared/
    db.ts                    # DynamoDB singleton (docClient) + buildUpdateExpression, X-Ray guarded
    response.ts              # Typed response builders: ok, created, noContent, badRequest, notFound, internalError + corsHeaders
    validation.ts            # validate<T>(schema, data) + parseBody(body)
  lambdas/
    accounts/                # create, list, get, update, delete + schema.ts + __tests__/
    transactions/            # create, list, get, update, delete, transfer, bulk-update, convert-to-transfer + schema.ts + __tests__/
    categories/              # create, list, get, update, delete + schema.ts + __tests__/
    budget/                  # create, list, get, update, delete, comparison + schema.ts + __tests__/
    analytics/               # get + __tests__/
```

## CDK Stacks

| Stack                    | Region      | Purpose                                     |
|--------------------------|-------------|---------------------------------------------|
| `BudgetAppBackendStack`  | eu-south-1  | 25 Lambdas + API Gateway + DynamoDB         |
| `BudgetCertificateStack` | us-east-1   | ACM TLS certificate for CloudFront          |
| `BudgetFrontendStack`    | eu-south-1  | S3 + CloudFront + Route 53                  |

## DynamoDB Tables

| Table           | Partition Key   | Sort Key        | GSIs                              |
|-----------------|-----------------|-----------------|-----------------------------------|
| BankAccounts    | `accountId`     | —               | —                                 |
| BankTransactions| `account`       | `transactionId` | `DateIndex`, `CategoryIndex`      |
| Categories      | `categoryId`    | —               | —                                 |
| BudgetPlanner   | `budgetId`      | —               | `YearIndex` (year + startMonth)   |

## Lambda Pattern

Each file in `lambdas/` exports a single `handler` function responsible for exactly one operation. There are no method-switching routers inside handlers.

Key conventions:
- `validate<T>(schema, data)` returns a discriminated union: `{ success: true; data: T } | { success: false; response }`. On failure, return the embedded `response` directly.
- `buildUpdateExpression(updates, omitKeys)` builds a DynamoDB `UpdateCommand` expression from a plain object, omitting keys that should not be overwritten (e.g. the primary key).
- `docClient` is a module-level DynamoDB singleton. X-Ray wrapping is guarded by `AWS_EXECUTION_ENV` so unit tests never call the real SDK.
- `test-setup.ts` mocks `aws-xray-sdk-core` for Jest.
- Lambda tests use `mockClient(DynamoDBDocumentClient)` at module level, reset in `beforeEach`.

## Shared Utilities (`src/shared/`)

| File            | Exports                                                                                      |
|-----------------|----------------------------------------------------------------------------------------------|
| `db.ts`         | `docClient`, `buildUpdateExpression(updates, omitKeys)`                                      |
| `response.ts`   | `ok`, `created`, `noContent`, `badRequest`, `notFound`, `internalError`, `corsHeaders`       |
| `validation.ts` | `validate<T>(schema, data)`, `parseBody(body)`                                               |

## API Endpoints

| Method   | Path                                        | Lambda                        |
|----------|---------------------------------------------|-------------------------------|
| GET      | `/accounts`                                 | accounts/list                 |
| POST     | `/accounts`                                 | accounts/create               |
| GET      | `/accounts/{accountId}`                     | accounts/get                  |
| PUT      | `/accounts/{accountId}`                     | accounts/update               |
| DELETE   | `/accounts/{accountId}`                     | accounts/delete               |
| GET      | `/transactions`                             | transactions/list             |
| POST     | `/transactions`                             | transactions/create           |
| GET      | `/transactions/{transactionId}`             | transactions/get              |
| PUT      | `/transactions/{transactionId}`             | transactions/update           |
| DELETE   | `/transactions/{transactionId}`             | transactions/delete           |
| POST     | `/transactions/transfer`                    | transactions/transfer         |
| PATCH    | `/transactions/bulk`                        | transactions/bulk-update      |
| POST     | `/transactions/{transactionId}/convert-to-transfer` | transactions/convert-to-transfer |
| GET      | `/categories`                               | categories/list               |
| POST     | `/categories`                               | categories/create             |
| GET      | `/categories/{categoryId}`                  | categories/get                |
| PUT      | `/categories/{categoryId}`                  | categories/update             |
| DELETE   | `/categories/{categoryId}`                  | categories/delete             |
| GET      | `/budget`                                   | budget/list                   |
| POST     | `/budget`                                   | budget/create                 |
| GET      | `/budget/comparison`                        | budget/comparison             |
| GET      | `/budget/{budgetId}`                        | budget/get                    |
| PUT      | `/budget/{budgetId}`                        | budget/update                 |
| DELETE   | `/budget/{budgetId}`                        | budget/delete                 |
| GET      | `/analytics`                                | analytics/get                 |

## CDK Rules

- `pointInTimeRecovery: true` is deprecated. Use:
  ```typescript
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true }
  ```
