# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
```bash
# Install dependencies
npm install

# Frontend development
npm run serve                 # Start React dev server
npm run build                # Build frontend for production

# Backend/Infrastructure
npm run cdk:bootstrap        # Bootstrap CDK (first time only)
npm run cdk:synth           # Generate CloudFormation templates
npm run cdk:diff            # Preview infrastructure changes
npm run cdk:deploy          # Deploy to AWS
npm run cdk:destroy         # Destroy AWS resources

# Testing
npm test                    # Run all tests
npm run test:frontend       # Frontend tests only
npm run test:backend        # Backend tests only

# Linting
npm run lint               # Lint all projects
npm run lint:frontend      # Frontend linting only
npm run lint:backend       # Backend linting only
```

## Architecture Overview

This is a full-stack budget application built as an Nx monorepo with three main components:

### Frontend (React + Vite)
- **Location**: `apps/frontend/src/`
- **Framework**: React 19 with TypeScript
- **Routing**: React Router DOM with client-side routing
- **Styling**: Inline styles (no CSS framework)
- **Key Components**:
  - `Navigation.tsx` - Top navigation bar with routing
  - `BankAccounts.tsx` - Full CRUD interface for bank account management
  - `DateTime.tsx` - Date/time service display
  - `Transactions.tsx` - Placeholder for transaction management

### Backend (AWS CDK + Lambda)
- **Location**: `backend/src/`
- **Infrastructure**: AWS CDK v2 with TypeScript
- **Runtime**: Node.js 18.x Lambda functions
- **Key Files**:
  - `main.ts` - CDK app entry point
  - `backend-stack.ts` - Complete infrastructure definition
  - `accounts-handler.ts` - Bank accounts CRUD Lambda
  - `transactions-handler.ts` - Bank transactions CRUD Lambda

### Database (DynamoDB)
Two main tables with pay-per-request billing:

**BankAccounts Table:**
- Partition Key: `accountId` (string)
- Stores: account name, number, bank, type, currency, balance, status

**BankTransactions Table:**
- Partition Key: `account` (string)
- Sort Key: `transactionId` (string)
- GSI: `DateIndex` (account + date), `CategoryIndex` (account + category)
- Stores: date, description, currency, amount, fee, category

## API Architecture

**Base URL**: Set via `VITE_API_ENDPOINT` environment variable

**Endpoints**:
- `GET /datetime` - Returns current server time
- `GET|POST /accounts` - List/create bank accounts
- `GET|PUT|DELETE /accounts/{accountId}` - Individual account operations
- `GET|POST /transactions` - List/create transactions (supports filtering)
- `GET|PUT|DELETE /transactions/{transactionId}` - Individual transaction operations

## Key Integration Points

### Frontend-Backend Communication
- Frontend uses `import.meta.env.VITE_API_ENDPOINT` for API base URL
- All Lambda functions return CORS headers for browser compatibility
- Error handling with user-friendly messages in UI components

### Lambda Function Structure
- Each handler supports multiple HTTP methods via `event.httpMethod` switching
- Input validation for required fields and enum values
- Consistent error response format with appropriate HTTP status codes
- Environment variables for DynamoDB table names

### DynamoDB Access Patterns
- Bank accounts: Direct access by `accountId`
- Transactions: Query by `account`, optionally filter by `category` or `date`
- GSI usage for efficient querying beyond primary key

## Development Notes

### CDK Asset Handling
Lambda functions use `lambda.Code.fromAsset('backend/src')` to include all handler files in the same deployment package.

### Environment Configuration
Set `VITE_API_ENDPOINT` to your deployed API Gateway URL after running `npm run cdk:deploy`.

### CORS Configuration
CORS is handled at both API Gateway level (via `defaultCorsPreflightOptions`) and Lambda level (via response headers).