# Backend App

AWS CDK v2 infrastructure and Lambda handlers for the family budget API.

## Stack

- **Infrastructure**: AWS CDK v2 (TypeScript)
- **Lambda runtime**: Node.js 18.x via `aws-cdk-lib/aws-lambda-nodejs` (esbuild bundling)
- **Database**: DynamoDB (pay-per-request, PITR enabled)
- **Observability**: AWS X-Ray tracing + `lambda-log`
- **Testing**: Jest

## Commands

```bash
npm run cdk:synth        # Generate CloudFormation templates (cdk.out/)
npm run cdk:diff         # Preview infrastructure changes vs deployed stack
npm run cdk:deploy       # Deploy all stacks to AWS
npm run cdk:destroy      # Destroy deployed stacks
npm run cdk:bootstrap    # One-time CDK bootstrap (first deploy only)
npm run test:backend     # Jest unit tests
npm run build:backend    # esbuild bundle → backend/dist/
```

## Source Layout

```
src/
  main.ts                    # CDK app entry point — instantiates all stacks
  backend-stack.ts           # Lambda functions, API Gateway, DynamoDB tables
  certificate-stack.ts       # ACM certificate (us-east-1, for CloudFront)
  frontend-stack.ts          # S3 + CloudFront + Route 53 for the React SPA
  assets/
    lambdas/
      accounts-handler.ts    # CRUD for BankAccounts table
      transactions-handler.ts# CRUD for BankTransactions table
      categories-handler.ts  # CRUD for Categories table
      budget-handler.ts      # CRUD + comparison for BudgetPlanner table
      analytics-handler.ts   # Read-only analytics over BankTransactions
```

## CDK Stacks

| Stack                    | Region      | Purpose                                     |
|--------------------------|-------------|---------------------------------------------|
| `BudgetAppBackendStack`  | eu-south-1  | Lambda + API Gateway + DynamoDB             |
| `BudgetCertificateStack` | us-east-1   | ACM TLS certificate for CloudFront          |
| `BudgetFrontendStack`    | eu-south-1  | S3 + CloudFront + Route 53                  |

## DynamoDB Tables

| Table          | Partition Key   | Sort Key        | GSIs                              |
|----------------|-----------------|-----------------|-----------------------------------|
| BankAccounts   | `accountId`     | —               | —                                 |
| BankTransactions| `account`      | `transactionId` | `DateIndex`, `CategoryIndex`      |
| Categories     | `categoryId`    | —               | —                                 |
| BudgetPlanner  | `budgetId`      | —               | `YearIndex` (year + startMonth)   |

## Lambda Handler Pattern

Each handler (`*-handler.ts`) follows the same structure:

1. Export a single `handler(event: APIGatewayProxyEvent)` function.
2. Switch on `event.httpMethod` to route to the correct operation.
3. Validate inputs and return appropriate HTTP status codes.
4. Always return CORS headers (`Access-Control-Allow-Origin: *`).
5. Use `AWSXRay.captureAWSv3Client` to wrap the DynamoDB client for tracing.

## API Endpoints

| Method | Path                                    | Handler               |
|--------|-----------------------------------------|-----------------------|
| GET/POST | `/accounts`                           | accounts-handler      |
| GET/PUT/DELETE | `/accounts/{accountId}`         | accounts-handler      |
| GET/POST | `/transactions`                       | transactions-handler  |
| GET/PUT/DELETE | `/transactions/{transactionId}` | transactions-handler  |
| POST   | `/transactions/transfer`               | transactions-handler  |
| POST   | `/transactions/bulkUpdate`             | transactions-handler  |
| PUT    | `/transactions/{id}/convert-to-transfer`| transactions-handler |
| GET/POST | `/categories`                         | categories-handler    |
| GET/PUT/DELETE | `/categories/{categoryId}`      | categories-handler    |
| GET/POST | `/budget`                             | budget-handler        |
| GET    | `/budget/comparison`                   | budget-handler        |
| GET/PUT/DELETE | `/budget/{budgetId}`            | budget-handler        |
| GET    | `/analytics`                           | analytics-handler     |

## CDK Rules

- `pointInTimeRecovery: true` is deprecated. Use:
  ```typescript
  pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true }
  ```
