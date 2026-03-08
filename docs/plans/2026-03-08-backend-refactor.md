# Backend Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move backend into apps/, split every Lambda handler into one file per HTTP operation, extract shared utilities, add Zod validation, and add unit tests with aws-sdk-client-mock — focusing on the budget feature.

**Architecture:** Each Lambda file exports a single `handler` with no routing switch. Shared DynamoDB client, CORS headers, response builders, and Zod validation live in `apps/backend/src/shared/`. The CDK stack defines 25 `NodejsFunction` constructs (one per operation), all pointing to the new file structure.

**Tech Stack:** AWS CDK v2, `aws-cdk-lib/aws-lambda-nodejs`, Zod, `aws-sdk-client-mock`, Jest, TypeScript

---

### Task 1: Move backend/ and backend-e2e/ into apps/

**Files:**
- Move: `backend/` → `apps/backend/`
- Move: `backend-e2e/` → `apps/backend-e2e/`

**Step 1: Move the directories**

```bash
cd /Users/hpfs/Developer/hpfs/family-budget
mv backend apps/backend
mv backend-e2e apps/backend-e2e
```

**Step 2: Verify the new structure**

```bash
ls apps/
```

Expected: `backend  backend-e2e  frontend  frontend-e2e`

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: move backend and backend-e2e into apps/"
```

---

### Task 2: Update all cross-references after directory move

**Files:**
- Modify: `cdk.json`
- Modify: `apps/backend/project.json`
- Modify: `apps/backend/tsconfig.json`
- Modify: `apps/backend/tsconfig.spec.json`
- Modify: `apps/backend/tsconfig.app.json` (if exists)
- Modify: `apps/backend/src/backend-stack.ts` (Lambda entry paths)
- Modify: `nx.json`

**Step 1: Update cdk.json**

Read current `cdk.json` app field and update `backend/src/main.ts` → `apps/backend/src/main.ts`:

```json
{
  "app": "npx ts-node --prefer-ts-exts apps/backend/src/main.ts"
}
```

**Step 2: Update apps/backend/project.json**

Change `root`, `sourceRoot`, and any command paths that reference `backend/`:

```json
{
  "name": "@budget-app/backend",
  "root": "apps/backend",
  "sourceRoot": "apps/backend/src",
  "projectType": "application",
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "outputs": ["{projectRoot}/dist"],
      "defaultConfiguration": "production",
      "options": {
        "command": "cd apps/backend && npx esbuild src/**/*.ts --bundle --platform=node --format=cjs --outdir=dist --sourcemap",
        "cwd": "{workspaceRoot}"
      },
      "configurations": {
        "development": {
          "command": "cd apps/backend && npx esbuild src/**/*.ts --bundle --platform=node --format=cjs --outdir=dist --sourcemap"
        },
        "production": {
          "command": "cd apps/backend && npx esbuild src/**/*.ts --bundle --platform=node --format=cjs --outdir=dist --minify"
        }
      }
    },
    "test": {
      "executor": "nx:run-commands",
      "options": {
        "command": "jest --passWithNoTests",
        "cwd": "{projectRoot}"
      }
    }
  },
  "tags": []
}
```

**Step 3: Update apps/backend/tsconfig.json — fix extends path**

The file previously lived at `backend/tsconfig.json` and extended `../tsconfig.base.json`. Now it's one level deeper, so it must extend `../../tsconfig.base.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "outDir": "dist",
    "declaration": true,
    "strict": true,
    "noUnusedLocals": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

Also update `apps/backend/tsconfig.spec.json` if it exists — same `extends` fix to `../../tsconfig.base.json`.

**Step 4: Update nx.json — fix backend-e2e exclude path**

Find the Jest plugin entry that excludes `backend-e2e/**/*` and update it:

```json
{
  "plugin": "@nx/jest/plugin",
  "options": { "targetName": "test" },
  "exclude": ["apps/backend-e2e/**/*"]
}
```

**Step 5: Update Lambda entry paths in apps/backend/src/backend-stack.ts**

Find `defaultFunctionProps`:

```typescript
entry: `backend/src/assets/lambdas/${name}.ts`,
```

Change to:

```typescript
entry: `apps/backend/src/assets/lambdas/${name}.ts`,
```

(This is a temporary fix — Task 10 will replace these with per-operation paths.)

**Step 6: Update apps/backend/src/main.ts CDK stack imports if they use relative paths**

Read the file and verify all import paths are still valid. They should be fine since they're relative within the same directory tree.

**Step 7: Verify CDK can parse the project**

```bash
npx cdk synth --quiet 2>&1 | tail -5
```

Expected: no errors, CloudFormation templates generated.

**Step 8: Verify backend tests still run**

```bash
npx nx test @budget-app/backend 2>&1 | tail -5
```

Expected: passes (or "no tests" if test files haven't been written yet).

**Step 9: Commit**

```bash
git add -A
git commit -m "refactor: update all references after backend move to apps/"
```

---

### Task 3: Install Zod and aws-sdk-client-mock

**Files:**
- Modify: `package.json` (root)
- Modify: `apps/backend/jest.config.ts`

**Step 1: Install packages**

```bash
npm install zod
npm install --save-dev aws-sdk-client-mock aws-sdk-client-mock-jest
```

**Step 2: Update apps/backend/jest.config.ts to add setup file**

Read the current `apps/backend/jest.config.ts` and add `setupFilesAfterEnv`:

```typescript
export default {
  displayName: '@budget-app/backend',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: 'test-output/jest/coverage',
  testMatch: ['**/__tests__/**/*.spec.ts'],
};
```

**Step 3: Create apps/backend/src/test-setup.ts**

This mocks X-Ray so it doesn't fail in test environments:

```typescript
// apps/backend/src/test-setup.ts
jest.mock('aws-xray-sdk-core', () => ({
  captureAWSv3Client: (client: unknown) => client,
}));
```

**Step 4: Verify install**

```bash
node -e "require('zod'); console.log('zod ok')"
node -e "require('aws-sdk-client-mock'); console.log('mock ok')"
```

Expected: both print ok.

**Step 5: Commit**

```bash
git add package.json package-lock.json apps/backend/jest.config.ts apps/backend/src/test-setup.ts
git commit -m "chore: install zod and aws-sdk-client-mock, configure jest setup"
```

---

### Task 4: Create shared utilities

**Files:**
- Create: `apps/backend/src/shared/db.ts`
- Create: `apps/backend/src/shared/response.ts`
- Create: `apps/backend/src/shared/validation.ts`

**Step 1: Create apps/backend/src/shared/db.ts**

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import AWSXRay from 'aws-xray-sdk-core';

const rawClient = new DynamoDBClient({});
// X-Ray is only active in the Lambda runtime (AWS_EXECUTION_ENV is set there)
const tracedClient = process.env['AWS_EXECUTION_ENV']
  ? AWSXRay.captureAWSv3Client(rawClient)
  : rawClient;

export const docClient = DynamoDBDocumentClient.from(tracedClient);

/** Build a DynamoDB SET update expression from a plain object.
 *  Omits keys listed in `omitKeys` (e.g. primary key fields). */
export const buildUpdateExpression = (
  updates: Record<string, unknown>,
  omitKeys: string[] = [],
): {
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
} => {
  const entries = Object.entries(updates).filter(
    ([k, v]) => !omitKeys.includes(k) && v !== undefined,
  );
  return {
    UpdateExpression: `SET ${entries.map((_, i) => `#attr${i} = :val${i}`).join(', ')}`,
    ExpressionAttributeNames: Object.fromEntries(entries.map(([k], i) => [`#attr${i}`, k])),
    ExpressionAttributeValues: Object.fromEntries(entries.map(([, v], i) => [`:val${i}`, v])),
  };
};
```

**Step 2: Create apps/backend/src/shared/response.ts**

```typescript
import { APIGatewayProxyResult } from 'aws-lambda';

export const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export const ok = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

export const created = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 201,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

export const noContent = (): APIGatewayProxyResult => ({
  statusCode: 204,
  headers: corsHeaders,
  body: '',
});

export const badRequest = (message: string): APIGatewayProxyResult => ({
  statusCode: 400,
  headers: corsHeaders,
  body: JSON.stringify({ error: message }),
});

export const notFound = (message: string): APIGatewayProxyResult => ({
  statusCode: 404,
  headers: corsHeaders,
  body: JSON.stringify({ error: message }),
});

export const internalError = (): APIGatewayProxyResult => ({
  statusCode: 500,
  headers: corsHeaders,
  body: JSON.stringify({ error: 'Internal server error' }),
});
```

**Step 3: Create apps/backend/src/shared/validation.ts**

```typescript
import { APIGatewayProxyResult } from 'aws-lambda';
import { ZodSchema } from 'zod';
import { badRequest } from './response';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: APIGatewayProxyResult };

export const validate = <T>(
  schema: ZodSchema<T>,
  data: unknown,
): ValidationResult<T> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    return { success: false, response: badRequest(message) };
  }
  return { success: true, data: result.data };
};

export const parseBody = (body: string | null): unknown => {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};
```

**Step 4: Commit**

```bash
git add apps/backend/src/shared/
git commit -m "feat: add shared db, response, and validation utilities"
```

---

### Task 5: Accounts resource — schema, Lambdas, tests

**Files:**
- Create: `apps/backend/src/lambdas/accounts/schema.ts`
- Create: `apps/backend/src/lambdas/accounts/create.ts`
- Create: `apps/backend/src/lambdas/accounts/list.ts`
- Create: `apps/backend/src/lambdas/accounts/get.ts`
- Create: `apps/backend/src/lambdas/accounts/update.ts`
- Create: `apps/backend/src/lambdas/accounts/delete.ts`
- Create: `apps/backend/src/lambdas/accounts/__tests__/create.spec.ts`
- Create: `apps/backend/src/lambdas/accounts/__tests__/list.spec.ts`
- Create: `apps/backend/src/lambdas/accounts/__tests__/get.spec.ts`
- Create: `apps/backend/src/lambdas/accounts/__tests__/update.spec.ts`
- Create: `apps/backend/src/lambdas/accounts/__tests__/delete.spec.ts`

**Step 1: Write failing tests first**

Create `apps/backend/src/lambdas/accounts/__tests__/create.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);

import { handler } from '../create';

const makeEvent = (body: unknown): Partial<APIGatewayProxyEvent> => ({
  body: JSON.stringify(body),
  pathParameters: null,
  queryStringParameters: null,
});

beforeEach(() => ddbMock.reset());

describe('POST /accounts — create', () => {
  const validPayload = {
    accountName: 'Main Current',
    accountNumber: '12345678',
    bankName: 'HSBC',
    accountType: 'CHECKING',
    currency: 'GBP',
  };

  it('creates an account and returns 201 with accountId', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(makeEvent(validPayload) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.accountId).toBeDefined();
    expect(body.accountName).toBe('Main Current');
    expect(body.isActive).toBe(true);
    expect(body.createdAt).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const result = await handler(makeEvent({}) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid accountType', async () => {
    const result = await handler(
      makeEvent({ ...validPayload, accountType: 'INVALID' }) as APIGatewayProxyEvent,
    );
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/accountType/i);
  });

  it('returns 400 for invalid currency', async () => {
    const result = await handler(
      makeEvent({ ...validPayload, currency: 'USD' }) as APIGatewayProxyEvent,
    );
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when body is null', async () => {
    const result = await handler({ body: null } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
```

Create `apps/backend/src/lambdas/accounts/__tests__/list.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../list';

beforeEach(() => ddbMock.reset());

describe('GET /accounts — list', () => {
  it('returns all accounts', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ accountId: 'a1' }], Count: 1 });
    const result = await handler({
      queryStringParameters: null,
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.accounts).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  it('filters by isActive when provided', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [], Count: 0 });
    const result = await handler({
      queryStringParameters: { isActive: 'true' },
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const calls = ddbMock.commandCalls(ScanCommand);
    expect(calls[0].args[0].input.FilterExpression).toContain('isActive');
  });
});
```

Create `apps/backend/src/lambdas/accounts/__tests__/get.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../get';

beforeEach(() => ddbMock.reset());

describe('GET /accounts/:accountId — get', () => {
  it('returns the account when found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { accountId: 'a1', accountName: 'Test' } });
    const result = await handler({
      pathParameters: { accountId: 'a1' },
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).accountName).toBe('Test');
  });

  it('returns 404 when account not found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await handler({
      pathParameters: { accountId: 'missing' },
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(404);
  });

  it('returns 400 when accountId is missing', async () => {
    const result = await handler({
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
```

Create `apps/backend/src/lambdas/accounts/__tests__/update.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../update';

beforeEach(() => ddbMock.reset());

describe('PUT /accounts/:accountId — update', () => {
  it('updates and returns the account', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { accountId: 'a1', accountName: 'Updated' } });
    const result = await handler({
      pathParameters: { accountId: 'a1' },
      body: JSON.stringify({ accountName: 'Updated' }),
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
  });

  it('returns 400 when body is empty object', async () => {
    const result = await handler({
      pathParameters: { accountId: 'a1' },
      body: '{}',
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when accountId missing', async () => {
    const result = await handler({
      pathParameters: null,
      body: JSON.stringify({ accountName: 'X' }),
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
```

Create `apps/backend/src/lambdas/accounts/__tests__/delete.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../delete';

beforeEach(() => ddbMock.reset());

describe('DELETE /accounts/:accountId — delete', () => {
  it('returns 204 on success', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const result = await handler({
      pathParameters: { accountId: 'a1' },
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(204);
  });

  it('returns 400 when accountId missing', async () => {
    const result = await handler({
      pathParameters: null,
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
```

**Step 2: Run tests — expect FAIL (files don't exist yet)**

```bash
cd apps/backend && npx jest src/lambdas/accounts --passWithNoTests 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../create'`

**Step 3: Create the schema**

`apps/backend/src/lambdas/accounts/schema.ts`:

```typescript
import { z } from 'zod';

export const CreateAccountSchema = z.object({
  accountName: z.string().min(1, 'accountName is required'),
  accountNumber: z.string().min(1, 'accountNumber is required'),
  bankName: z.string().min(1, 'bankName is required'),
  accountType: z.enum(['CHECKING', 'SAVINGS', 'CREDIT', 'INVESTMENT'], {
    errorMap: () => ({ message: 'accountType must be CHECKING, SAVINGS, CREDIT, or INVESTMENT' }),
  }),
  currency: z.enum(['GBP', 'EUR'], {
    errorMap: () => ({ message: 'currency must be GBP or EUR' }),
  }),
  balance: z.number().optional(),
  isActive: z.boolean().default(true),
});

export const UpdateAccountSchema = CreateAccountSchema.partial().omit({ isActive: true }).extend({
  isActive: z.boolean().optional(),
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;
```

**Step 4: Create the Lambda files**

`apps/backend/src/lambdas/accounts/create.ts`:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { created, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { CreateAccountSchema } from './schema';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BankAccounts';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const raw = parseBody(event.body);
    if (raw === null) return { statusCode: 400, headers: {}, body: JSON.stringify({ error: 'Invalid JSON' }) };

    const parsed = validate(CreateAccountSchema, raw);
    if (!parsed.success) return parsed.response;

    const now = new Date().toISOString();
    const account = {
      accountId: uuidv4(),
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: account }));
    return created(account);
  } catch (error) {
    log.error('createAccount error', { error });
    return internalError();
  }
};
```

`apps/backend/src/lambdas/accounts/list.ts`:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BankAccounts';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const isActive = event.queryStringParameters?.['isActive'];
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      ...(isActive !== undefined && {
        FilterExpression: 'isActive = :isActive',
        ExpressionAttributeValues: { ':isActive': isActive === 'true' },
      }),
    }));
    return ok({ accounts: result.Items ?? [], count: result.Count ?? 0 });
  } catch (error) {
    log.error('listAccounts error', { error });
    return internalError();
  }
};
```

`apps/backend/src/lambdas/accounts/get.ts`:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, notFound, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BankAccounts';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { accountId } = event.pathParameters ?? {};
    if (!accountId) return badRequest('accountId is required');

    const result = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { accountId } }));
    if (!result.Item) return notFound('Account not found');
    return ok(result.Item);
  } catch (error) {
    log.error('getAccount error', { error });
    return internalError();
  }
};
```

`apps/backend/src/lambdas/accounts/update.ts`:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient, buildUpdateExpression } from '../../shared/db';
import { ok, badRequest, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { UpdateAccountSchema } from './schema';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BankAccounts';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { accountId } = event.pathParameters ?? {};
    if (!accountId) return badRequest('accountId is required');

    const raw = parseBody(event.body);
    if (raw === null) return badRequest('Invalid JSON');

    const parsed = validate(UpdateAccountSchema, raw);
    if (!parsed.success) return parsed.response;

    const updates = { ...parsed.data, updatedAt: new Date().toISOString() };
    const expr = buildUpdateExpression(updates, ['accountId', 'createdAt']);

    if (!expr.UpdateExpression.includes('=')) return badRequest('No valid fields to update');

    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { accountId },
      ...expr,
      ReturnValues: 'ALL_NEW',
    }));
    return ok(result.Attributes);
  } catch (error) {
    log.error('updateAccount error', { error });
    return internalError();
  }
};
```

`apps/backend/src/lambdas/accounts/delete.ts`:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { noContent, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BankAccounts';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { accountId } = event.pathParameters ?? {};
    if (!accountId) return badRequest('accountId is required');
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { accountId } }));
    return noContent();
  } catch (error) {
    log.error('deleteAccount error', { error });
    return internalError();
  }
};
```

**Step 5: Run tests — expect PASS**

```bash
cd apps/backend && npx jest src/lambdas/accounts 2>&1 | tail -15
```

Expected: all 13 tests PASS.

**Step 6: Commit**

```bash
git add apps/backend/src/lambdas/accounts/
git commit -m "feat: add accounts lambdas with zod validation and unit tests"
```

---

### Task 6: Categories resource — schema, Lambdas, tests

**Files:** Same pattern as accounts. Create in `apps/backend/src/lambdas/categories/`.

**Step 1: Create schema** — `apps/backend/src/lambdas/categories/schema.ts`:

```typescript
import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
```

**Step 2: Create Lambda files** — follow the exact same pattern as accounts, substituting:
- Table env var: `TABLE_NAME` → `'Categories'`
- Primary key: `accountId` → `categoryId`
- Table scan result key: `accounts` → `categories`
- Generate: `categoryId: uuidv4()` instead of `accountId`
- Schema: `CreateCategorySchema` / `UpdateCategorySchema`

Files to create:
- `create.ts` — validates with `CreateCategorySchema`, PutCommand, returns 201
- `list.ts` — ScanCommand with optional `isActive` filter, returns `{ categories, count }`
- `get.ts` — GetCommand by `categoryId`, 404 if not found
- `update.ts` — UpdateCommand via `buildUpdateExpression`, omit `categoryId`/`createdAt`
- `delete.ts` — DeleteCommand by `categoryId`, returns 204

**Step 3: Write tests** — follow the exact same test pattern as accounts. Write `__tests__/create.spec.ts` and `__tests__/list.spec.ts` at minimum.

**Step 4: Run tests**

```bash
cd apps/backend && npx jest src/lambdas/categories 2>&1 | tail -10
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add apps/backend/src/lambdas/categories/
git commit -m "feat: add categories lambdas with zod validation and unit tests"
```

---

### Task 7: Budget resource — schema, Lambdas, tests (primary focus)

**Files:**
- Create: `apps/backend/src/lambdas/budget/schema.ts`
- Create: `apps/backend/src/lambdas/budget/create.ts`
- Create: `apps/backend/src/lambdas/budget/list.ts`
- Create: `apps/backend/src/lambdas/budget/get.ts`
- Create: `apps/backend/src/lambdas/budget/update.ts`
- Create: `apps/backend/src/lambdas/budget/delete.ts`
- Create: `apps/backend/src/lambdas/budget/comparison.ts`
- Create: `apps/backend/src/lambdas/budget/__tests__/create.spec.ts`
- Create: `apps/backend/src/lambdas/budget/__tests__/list.spec.ts`
- Create: `apps/backend/src/lambdas/budget/__tests__/get.spec.ts`
- Create: `apps/backend/src/lambdas/budget/__tests__/update.spec.ts`
- Create: `apps/backend/src/lambdas/budget/__tests__/delete.spec.ts`
- Create: `apps/backend/src/lambdas/budget/__tests__/comparison.spec.ts`

**Step 1: Write all failing tests first**

`apps/backend/src/lambdas/budget/__tests__/create.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../create';

const makeEvent = (body: unknown): Partial<APIGatewayProxyEvent> => ({
  body: JSON.stringify(body),
  pathParameters: null,
  queryStringParameters: null,
});

const validPayload = {
  name: 'Groceries',
  categoryId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  amount: 300,
  currency: 'GBP',
  type: 'monthly',
  startMonth: '2026-01',
  endMonth: '2026-12',
  year: 2026,
};

beforeEach(() => ddbMock.reset());

describe('POST /budget — create', () => {
  it('creates a budget item and returns 201', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(makeEvent(validPayload) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.budgetId).toBeDefined();
    expect(body.name).toBe('Groceries');
    expect(body.isActive).toBe(true);
  });

  it('returns 400 when name is missing', async () => {
    const { name: _, ...rest } = validPayload;
    const result = await handler(makeEvent(rest) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/name/i);
  });

  it('returns 400 for invalid budget type', async () => {
    const result = await handler(makeEvent({ ...validPayload, type: 'weekly' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid currency', async () => {
    const result = await handler(makeEvent({ ...validPayload, currency: 'USD' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid startMonth format', async () => {
    const result = await handler(makeEvent({ ...validPayload, startMonth: '2026/01' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for negative amount', async () => {
    const result = await handler(makeEvent({ ...validPayload, amount: -50 }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when body is null', async () => {
    const result = await handler({ body: null } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
```

`apps/backend/src/lambdas/budget/__tests__/list.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../list';

beforeEach(() => ddbMock.reset());

describe('GET /budget — list', () => {
  it('returns budget items filtered by current year by default', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ budgetId: 'b1' }], Count: 1 });
    const result = await handler({ queryStringParameters: null } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.items).toHaveLength(1);
    expect(body.count).toBe(1);
    const scan = ddbMock.commandCalls(ScanCommand)[0];
    expect(scan.args[0].input.ExpressionAttributeValues?.[':year']).toBe(new Date().getFullYear());
  });

  it('filters by provided year', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [], Count: 0 });
    await handler({ queryStringParameters: { year: '2025' } } as unknown as APIGatewayProxyEvent);
    const scan = ddbMock.commandCalls(ScanCommand)[0];
    expect(scan.args[0].input.ExpressionAttributeValues?.[':year']).toBe(2025);
  });
});
```

`apps/backend/src/lambdas/budget/__tests__/get.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../get';

beforeEach(() => ddbMock.reset());

describe('GET /budget/:budgetId — get', () => {
  it('returns the budget item', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { budgetId: 'b1', name: 'Groceries' } });
    const result = await handler({ pathParameters: { budgetId: 'b1' } } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).name).toBe('Groceries');
  });

  it('returns 404 when not found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await handler({ pathParameters: { budgetId: 'missing' } } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(404);
  });

  it('returns 400 when budgetId missing', async () => {
    const result = await handler({ pathParameters: null } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
```

`apps/backend/src/lambdas/budget/__tests__/update.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../update';

beforeEach(() => ddbMock.reset());

describe('PUT /budget/:budgetId — update', () => {
  it('updates and returns the item', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { budgetId: 'b1', amount: 500 } });
    const result = await handler({
      pathParameters: { budgetId: 'b1' },
      body: JSON.stringify({ amount: 500 }),
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
  });

  it('returns 400 for invalid type in update', async () => {
    const result = await handler({
      pathParameters: { budgetId: 'b1' },
      body: JSON.stringify({ type: 'not-valid' }),
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when no fields provided', async () => {
    const result = await handler({
      pathParameters: { budgetId: 'b1' },
      body: '{}',
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
```

`apps/backend/src/lambdas/budget/__tests__/delete.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../delete';

beforeEach(() => ddbMock.reset());

describe('DELETE /budget/:budgetId — delete', () => {
  it('returns 204', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const result = await handler({ pathParameters: { budgetId: 'b1' } } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(204);
  });

  it('returns 400 when budgetId missing', async () => {
    const result = await handler({ pathParameters: null } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
```

`apps/backend/src/lambdas/budget/__tests__/comparison.spec.ts` — this is the most important test:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../comparison';

beforeEach(() => ddbMock.reset());

const makeEvent = (qs: Record<string, string>): Partial<APIGatewayProxyEvent> => ({
  queryStringParameters: qs,
});

describe('GET /budget/comparison', () => {
  it('returns monthly comparison with planned vs actual', async () => {
    // First ScanCommand = budget items, Second = transactions
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({
        Items: [{
          budgetId: 'b1',
          categoryId: 'cat1',
          amount: 300,
          type: 'monthly',
          startMonth: '2026-01',
          endMonth: '2026-12',
          year: 2026,
          isActive: true,
        }],
      })
      .resolvesOnce({
        Items: [{
          account: 'acc1',
          transactionId: 't1',
          date: '2026-03-15',
          category: 'cat1',
          amount: -250,
        }],
      });

    const result = await handler(makeEvent({ year: '2026', month: '03' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.months).toHaveLength(1);
    const march = body.months[0];
    expect(march.month).toBe('2026-03');
    expect(march.totalPlanned).toBe(300);
    expect(march.totalActual).toBe(250);
    expect(march.categories[0].categoryId).toBe('cat1');
    expect(march.categories[0].planned).toBe(300);
    expect(march.categories[0].actual).toBe(250);
    expect(march.categories[0].delta).toBe(50);
  });

  it('returns delta equals planned when no transactions exist', async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({
        Items: [{ budgetId: 'b1', categoryId: 'cat1', amount: 100, type: 'monthly',
          startMonth: '2026-01', endMonth: '2026-12', year: 2026, isActive: true }],
      })
      .resolvesOnce({ Items: [] });

    const result = await handler(makeEvent({ year: '2026', month: '01' }) as APIGatewayProxyEvent);
    const body = JSON.parse(result.body);
    expect(body.months[0].categories[0].delta).toBe(100);
    expect(body.months[0].totalActual).toBe(0);
  });

  it('returns empty months array when no budget items exist', async () => {
    ddbMock.on(ScanCommand).resolvesOnce({ Items: [] }).resolvesOnce({ Items: [] });

    const result = await handler(makeEvent({ year: '2026', month: '01' }) as APIGatewayProxyEvent);
    const body = JSON.parse(result.body);
    expect(body.months[0].categories).toHaveLength(0);
    expect(body.months[0].totalPlanned).toBe(0);
  });

  it('returns 12 months when no month filter provided', async () => {
    ddbMock.on(ScanCommand).resolvesOnce({ Items: [] }).resolvesOnce({ Items: [] });

    const result = await handler(makeEvent({ year: '2026' }) as APIGatewayProxyEvent);
    const body = JSON.parse(result.body);
    expect(body.months).toHaveLength(12);
  });

  it('ignores one-time budget items outside their startMonth', async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({
        Items: [{ budgetId: 'b1', categoryId: 'cat1', amount: 500, type: 'one-time',
          startMonth: '2026-01', endMonth: '2026-01', year: 2026, isActive: true }],
      })
      .resolvesOnce({ Items: [] });

    // Request March — one-time item was in January, should not appear
    const result = await handler(makeEvent({ year: '2026', month: '03' }) as APIGatewayProxyEvent);
    const body = JSON.parse(result.body);
    expect(body.months[0].totalPlanned).toBe(0);
  });

  it('returns 400 when year query param is missing', async () => {
    const result = await handler(makeEvent({}) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
```

**Step 2: Run tests — expect FAIL**

```bash
cd apps/backend && npx jest src/lambdas/budget 2>&1 | tail -5
```

Expected: FAIL — modules not found.

**Step 3: Create schema**

`apps/backend/src/lambdas/budget/schema.ts`:

```typescript
import { z } from 'zod';

export const CreateBudgetSchema = z.object({
  name: z.string().min(1, 'name is required'),
  categoryId: z.string().min(1, 'categoryId is required'),
  amount: z.number().positive('amount must be positive'),
  currency: z.enum(['GBP', 'EUR']),
  type: z.enum(['monthly', 'periodic', 'one-time']),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/, 'startMonth must be YYYY-MM'),
  endMonth: z.string().regex(/^\d{4}-\d{2}$/, 'endMonth must be YYYY-MM'),
  year: z.number().int().min(2000).max(2100),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const UpdateBudgetSchema = CreateBudgetSchema.partial();

export const BudgetComparisonQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/, 'year must be a 4-digit number').transform(Number),
  month: z.string().regex(/^\d{2}$/).optional().transform(v => v ? Number(v) : undefined),
});

export type CreateBudgetInput = z.infer<typeof CreateBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof UpdateBudgetSchema>;
```

**Step 4: Create Lambda files**

`apps/backend/src/lambdas/budget/create.ts`:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { created, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { CreateBudgetSchema } from './schema';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BudgetPlanner';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const raw = parseBody(event.body);
    if (raw === null) return { statusCode: 400, headers: {}, body: JSON.stringify({ error: 'Invalid JSON' }) };

    const parsed = validate(CreateBudgetSchema, raw);
    if (!parsed.success) return parsed.response;

    const now = new Date().toISOString();
    const item = { budgetId: uuidv4(), ...parsed.data, createdAt: now, updatedAt: now };
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    return created(item);
  } catch (error) {
    log.error('createBudget error', { error });
    return internalError();
  }
};
```

`apps/backend/src/lambdas/budget/list.ts`:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BudgetPlanner';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const year = event.queryStringParameters?.['year']
      ? parseInt(event.queryStringParameters['year'])
      : new Date().getFullYear();

    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: '#yr = :year',
      ExpressionAttributeNames: { '#yr': 'year' },
      ExpressionAttributeValues: { ':year': year },
    }));
    return ok({ items: result.Items ?? [], count: result.Count ?? 0 });
  } catch (error) {
    log.error('listBudget error', { error });
    return internalError();
  }
};
```

`apps/backend/src/lambdas/budget/get.ts`:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, notFound, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BudgetPlanner';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { budgetId } = event.pathParameters ?? {};
    if (!budgetId) return badRequest('budgetId is required');
    const result = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { budgetId } }));
    if (!result.Item) return notFound('Budget item not found');
    return ok(result.Item);
  } catch (error) {
    log.error('getBudget error', { error });
    return internalError();
  }
};
```

`apps/backend/src/lambdas/budget/update.ts`:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient, buildUpdateExpression } from '../../shared/db';
import { ok, badRequest, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { UpdateBudgetSchema } from './schema';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BudgetPlanner';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { budgetId } = event.pathParameters ?? {};
    if (!budgetId) return badRequest('budgetId is required');

    const raw = parseBody(event.body);
    if (raw === null) return badRequest('Invalid JSON');

    const parsed = validate(UpdateBudgetSchema, raw);
    if (!parsed.success) return parsed.response;

    const updates = { ...parsed.data, updatedAt: new Date().toISOString() };
    const expr = buildUpdateExpression(updates, ['budgetId', 'createdAt']);

    if (!expr.UpdateExpression.includes('=')) return badRequest('No valid fields to update');

    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { budgetId },
      ...expr,
      ReturnValues: 'ALL_NEW',
    }));
    return ok(result.Attributes);
  } catch (error) {
    log.error('updateBudget error', { error });
    return internalError();
  }
};
```

`apps/backend/src/lambdas/budget/delete.ts`:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { noContent, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BudgetPlanner';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { budgetId } = event.pathParameters ?? {};
    if (!budgetId) return badRequest('budgetId is required');
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { budgetId } }));
    return noContent();
  } catch (error) {
    log.error('deleteBudget error', { error });
    return internalError();
  }
};
```

`apps/backend/src/lambdas/budget/comparison.ts`:

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, internalError } from '../../shared/response';
import { validate } from '../../shared/validation';
import { BudgetComparisonQuerySchema } from './schema';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BudgetPlanner';
const TABLE_NAME_TRANSACTIONS = process.env['TABLE_NAME_TRANSACTIONS'] ?? 'BankTransactions';

interface BudgetItem {
  budgetId: string;
  categoryId: string;
  amount: number;
  type: 'monthly' | 'periodic' | 'one-time';
  startMonth: string;
  endMonth: string;
  year: number;
  isActive: boolean;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const parsed = validate(BudgetComparisonQuerySchema, event.queryStringParameters ?? {});
    if (!parsed.success) return parsed.response;

    const { year, month } = parsed.data;

    const budgetResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: '#yr = :year AND isActive = :active',
      ExpressionAttributeNames: { '#yr': 'year' },
      ExpressionAttributeValues: { ':year': year, ':active': true },
    }));
    const budgetItems = (budgetResult.Items ?? []) as BudgetItem[];

    const startDate = month
      ? `${year}-${String(month).padStart(2, '0')}-01`
      : `${year}-01-01`;
    const endDate = month
      ? `${year}-${String(month).padStart(2, '0')}-31`
      : `${year}-12-31`;

    const txResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME_TRANSACTIONS,
      FilterExpression: '#date BETWEEN :start AND :end',
      ExpressionAttributeNames: { '#date': 'date' },
      ExpressionAttributeValues: { ':start': startDate, ':end': endDate },
    }));
    const transactions = txResult.Items ?? [];

    const months = month
      ? [month]
      : Array.from({ length: 12 }, (_, i) => i + 1);

    const result = months.map(m => {
      const monthStr = `${year}-${String(m).padStart(2, '0')}`;

      const categoryPlanned: Record<string, number> = {};
      for (const item of budgetItems) {
        if (monthStr >= item.startMonth && monthStr <= item.endMonth) {
          if (item.type === 'one-time') {
            if (monthStr === item.startMonth) {
              categoryPlanned[item.categoryId] = (categoryPlanned[item.categoryId] ?? 0) + item.amount;
            }
          } else {
            categoryPlanned[item.categoryId] = (categoryPlanned[item.categoryId] ?? 0) + item.amount;
          }
        }
      }

      const categoryActual: Record<string, number> = {};
      for (const tx of transactions) {
        const txDate = tx['date'] as string;
        if (txDate?.startsWith(monthStr)) {
          const cat = tx['category'] as string;
          categoryActual[cat] = (categoryActual[cat] ?? 0) + Math.abs(tx['amount'] as number);
        }
      }

      const allCategories = new Set([...Object.keys(categoryPlanned), ...Object.keys(categoryActual)]);
      const categories = Array.from(allCategories).map(categoryId => {
        const planned = categoryPlanned[categoryId] ?? 0;
        const actual = categoryActual[categoryId] ?? 0;
        return { categoryId, planned, actual, delta: planned - actual };
      });

      return {
        month: monthStr,
        categories,
        totalPlanned: categories.reduce((s, c) => s + c.planned, 0),
        totalActual: categories.reduce((s, c) => s + c.actual, 0),
      };
    });

    return ok({ months: result });
  } catch (error) {
    log.error('getBudgetComparison error', { error });
    return internalError();
  }
};
```

**Step 5: Run tests — expect PASS**

```bash
cd apps/backend && npx jest src/lambdas/budget 2>&1 | tail -15
```

Expected: all 20 tests PASS.

**Step 6: Commit**

```bash
git add apps/backend/src/lambdas/budget/
git commit -m "feat: add budget lambdas with zod validation and comprehensive unit tests"
```

---

### Task 8: Transactions resource — schema, Lambdas, tests

**Files:** Create in `apps/backend/src/lambdas/transactions/`.

**Step 1: Create schema** — `apps/backend/src/lambdas/transactions/schema.ts`:

```typescript
import { z } from 'zod';

export const CreateTransactionSchema = z.object({
  account: z.string().min(1, 'account is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  description: z.string().min(1, 'description is required'),
  currency: z.enum(['GBP', 'EUR']),
  amount: z.number(),
  fee: z.number().default(0),
  category: z.string().min(1, 'category is required'),
  transferId: z.string().optional(),
  transferType: z.enum(['outgoing', 'incoming', 'regular']).optional(),
  relatedAccount: z.string().optional(),
});

export const UpdateTransactionSchema = CreateTransactionSchema.partial().omit({
  account: true,
  transactionId: true,
} as never);

export const CreateTransferSchema = z.object({
  fromAccount: z.string().min(1),
  toAccount: z.string().min(1),
  amount: z.number().positive(),
  currency: z.enum(['GBP', 'EUR']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1),
  fee: z.number().default(0),
}).refine(data => data.fromAccount !== data.toAccount, {
  message: 'Cannot transfer to the same account',
});

export const BulkUpdateSchema = z.object({
  transactionIds: z.array(z.string()).min(1),
  account: z.string().min(1),
  category: z.string().min(1),
});

export const ConvertToTransferSchema = z.object({
  toAccount: z.string().min(1, 'toAccount is required'),
});

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;
export type CreateTransferInput = z.infer<typeof CreateTransferSchema>;
```

**Step 2: Write key tests first**

Write `__tests__/transfer.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../transfer';

const validTransfer = {
  fromAccount: 'acc-from',
  toAccount: 'acc-to',
  amount: 500,
  currency: 'GBP',
  date: '2026-03-08',
  description: 'Monthly transfer',
};

beforeEach(() => ddbMock.reset());

describe('POST /transactions/transfer', () => {
  it('creates outgoing and incoming transactions, returns 201', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler({ body: JSON.stringify(validTransfer) } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.transferId).toBeDefined();
    expect(body.outgoingTransaction.amount).toBeLessThan(0);
    expect(body.incomingTransaction.amount).toBeGreaterThan(0);
    expect(body.outgoingTransaction.transferType).toBe('outgoing');
    expect(body.incomingTransaction.transferType).toBe('incoming');
    // Both transactions share the same transferId
    expect(body.outgoingTransaction.transferId).toBe(body.transferId);
    expect(body.incomingTransaction.transferId).toBe(body.transferId);
    // Verify two PutCommands were issued
    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(2);
  });

  it('returns 400 when fromAccount equals toAccount', async () => {
    const result = await handler({
      body: JSON.stringify({ ...validTransfer, toAccount: 'acc-from' }),
    } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid currency', async () => {
    const result = await handler({
      body: JSON.stringify({ ...validTransfer, currency: 'USD' }),
    } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for negative amount', async () => {
    const result = await handler({
      body: JSON.stringify({ ...validTransfer, amount: -100 }),
    } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
```

Write `__tests__/create.spec.ts` for regular transaction creation (same pattern as accounts `create.spec.ts` but with transaction fields).

Write `__tests__/convert-to-transfer.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../convert-to-transfer';

beforeEach(() => ddbMock.reset());

const makeEvent = (transactionId: string, account: string, body: unknown) => ({
  pathParameters: { transactionId },
  queryStringParameters: { account },
  body: JSON.stringify(body),
});

describe('PUT /transactions/:id/convert-to-transfer', () => {
  const originalTx = {
    account: 'acc1', transactionId: 'tx1', amount: -200,
    date: '2026-03-08', description: 'Coffee', currency: 'GBP', fee: 0, category: 'food',
  };

  it('converts transaction and creates incoming counterpart', async () => {
    ddbMock.on(GetCommand).resolves({ Item: originalTx });
    ddbMock.on(UpdateCommand).resolves({ Attributes: { ...originalTx, transferType: 'outgoing' } });
    ddbMock.on(PutCommand).resolves({});

    const result = await handler(makeEvent('tx1', 'acc1', { toAccount: 'acc2' }) as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.transferId).toBeDefined();
    expect(body.incomingTransaction.account).toBe('acc2');
    expect(body.incomingTransaction.amount).toBeGreaterThan(0);
  });

  it('returns 404 when transaction not found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await handler(makeEvent('missing', 'acc1', { toAccount: 'acc2' }) as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(404);
  });

  it('returns 400 when toAccount is missing', async () => {
    const result = await handler(makeEvent('tx1', 'acc1', {}) as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when same account used for from and to', async () => {
    const result = await handler(makeEvent('tx1', 'acc1', { toAccount: 'acc1' }) as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
```

**Step 3: Create Lambda files** — follow the same structure. Create:
- `create.ts` — validates with `CreateTransactionSchema`, PutCommand
- `list.ts` — QueryCommand with optional category/date GSI filter (port logic from original handler)
- `get.ts` — GetCommand with composite key `{ account, transactionId }` (both from query params)
- `update.ts` — UpdateCommand with `buildUpdateExpression`, omit `account`/`transactionId`
- `delete.ts` — DeleteCommand with composite key
- `transfer.ts` — validates with `CreateTransferSchema`, Promise.all two PutCommands
- `bulk-update.ts` — validates, Promise.all multiple UpdateCommands for category field
- `convert-to-transfer.ts` — GetCommand + UpdateCommand + PutCommand, validates with `ConvertToTransferSchema`

**Step 4: Run tests**

```bash
cd apps/backend && npx jest src/lambdas/transactions 2>&1 | tail -15
```

Expected: all tests PASS.

**Step 5: Commit**

```bash
git add apps/backend/src/lambdas/transactions/
git commit -m "feat: add transactions lambdas with zod validation and unit tests"
```

---

### Task 9: Analytics resource — Lambda and test

**Files:**
- Create: `apps/backend/src/lambdas/analytics/get.ts`
- Create: `apps/backend/src/lambdas/analytics/__tests__/get.spec.ts`

**Step 1: Write failing test**

`apps/backend/src/lambdas/analytics/__tests__/get.spec.ts`:

```typescript
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../get';

beforeEach(() => ddbMock.reset());

describe('GET /analytics', () => {
  it('returns monthlyTrends, categoryBreakdown, and summary', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { account: 'acc1', transactionId: 't1', date: '2026-03-01', amount: 1000, category: 'income' },
        { account: 'acc1', transactionId: 't2', date: '2026-03-15', amount: -250, category: 'groceries' },
      ],
    });

    const result = await handler({ queryStringParameters: { account: 'acc1' } } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.summary.totalIncome).toBe(1000);
    expect(body.summary.totalExpenses).toBe(250);
    expect(body.summary.balance).toBe(750);
    expect(body.monthlyTrends).toBeDefined();
    expect(body.categoryBreakdown).toBeDefined();
  });

  it('returns 400 when account is not provided', async () => {
    const result = await handler({ queryStringParameters: null } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
```

**Step 2: Create the Lambda** — port logic from `analytics-handler.ts`, removing the switch statement. Import from shared utilities:

`apps/backend/src/lambdas/analytics/get.ts` — QueryCommand by account for last 12 months, call `calculateMonthlyTrends`, `calculateCategoryBreakdown`, `calculateSummary` as private functions in the same file.

**Step 3: Run tests**

```bash
cd apps/backend && npx jest src/lambdas/analytics 2>&1 | tail -5
```

Expected: PASS.

**Step 4: Commit**

```bash
git add apps/backend/src/lambdas/analytics/
git commit -m "feat: add analytics lambda with unit test"
```

---

### Task 10: Update CDK backend-stack.ts with 25 Lambda constructs

**Files:**
- Modify: `apps/backend/src/backend-stack.ts`

**Step 1: Replace the defaultFunctionProps helper and all Lambda constructs**

The helper now takes a full relative path instead of a handler name:

```typescript
const fn = (
  scope: Construct,
  id: string,
  entry: string,
  env: Record<string, string>,
): lambda.NodejsFunction =>
  new lambda.NodejsFunction(scope, id, {
    handler: 'handler',
    entry,
    depsLockFilePath: 'package-lock.json',
    bundling: { minify: true, loader: { '.node': 'file' }, sourceMap: true },
    timeout: cdk.Duration.seconds(30),
    tracing: awslambda.Tracing.ACTIVE,
    environment: env,
  });
```

Replace all 5 existing Lambda constructs with 25, one per operation:

```typescript
// ── Accounts (5) ──────────────────────────────────────────────────────────
const createAccount  = fn(this, 'CreateAccount',  'apps/backend/src/lambdas/accounts/create.ts',  { TABLE_NAME: accountsTable.tableName });
const listAccounts   = fn(this, 'ListAccounts',   'apps/backend/src/lambdas/accounts/list.ts',    { TABLE_NAME: accountsTable.tableName });
const getAccount     = fn(this, 'GetAccount',     'apps/backend/src/lambdas/accounts/get.ts',     { TABLE_NAME: accountsTable.tableName });
const updateAccount  = fn(this, 'UpdateAccount',  'apps/backend/src/lambdas/accounts/update.ts',  { TABLE_NAME: accountsTable.tableName });
const deleteAccount  = fn(this, 'DeleteAccount',  'apps/backend/src/lambdas/accounts/delete.ts',  { TABLE_NAME: accountsTable.tableName });

// ── Categories (5) ────────────────────────────────────────────────────────
const createCategory = fn(this, 'CreateCategory', 'apps/backend/src/lambdas/categories/create.ts', { TABLE_NAME: categoriesTable.tableName });
const listCategories = fn(this, 'ListCategories', 'apps/backend/src/lambdas/categories/list.ts',   { TABLE_NAME: categoriesTable.tableName });
const getCategory    = fn(this, 'GetCategory',    'apps/backend/src/lambdas/categories/get.ts',    { TABLE_NAME: categoriesTable.tableName });
const updateCategory = fn(this, 'UpdateCategory', 'apps/backend/src/lambdas/categories/update.ts', { TABLE_NAME: categoriesTable.tableName });
const deleteCategory = fn(this, 'DeleteCategory', 'apps/backend/src/lambdas/categories/delete.ts', { TABLE_NAME: categoriesTable.tableName });

// ── Budget (6) ────────────────────────────────────────────────────────────
const budgetEnv = { TABLE_NAME: budgetTable.tableName, TABLE_NAME_TRANSACTIONS: transactionsTable.tableName };
const createBudget     = fn(this, 'CreateBudget',     'apps/backend/src/lambdas/budget/create.ts',     budgetEnv);
const listBudget       = fn(this, 'ListBudget',       'apps/backend/src/lambdas/budget/list.ts',       budgetEnv);
const getBudget        = fn(this, 'GetBudget',        'apps/backend/src/lambdas/budget/get.ts',        budgetEnv);
const updateBudget     = fn(this, 'UpdateBudget',     'apps/backend/src/lambdas/budget/update.ts',     budgetEnv);
const deleteBudget     = fn(this, 'DeleteBudget',     'apps/backend/src/lambdas/budget/delete.ts',     budgetEnv);
const budgetComparison = fn(this, 'BudgetComparison', 'apps/backend/src/lambdas/budget/comparison.ts', budgetEnv);

// ── Transactions (8) ──────────────────────────────────────────────────────
const txEnv = { TABLE_NAME: transactionsTable.tableName };
const createTransaction        = fn(this, 'CreateTransaction',        'apps/backend/src/lambdas/transactions/create.ts',              txEnv);
const listTransactions         = fn(this, 'ListTransactions',         'apps/backend/src/lambdas/transactions/list.ts',               txEnv);
const getTransaction           = fn(this, 'GetTransaction',           'apps/backend/src/lambdas/transactions/get.ts',                txEnv);
const updateTransaction        = fn(this, 'UpdateTransaction',        'apps/backend/src/lambdas/transactions/update.ts',             txEnv);
const deleteTransaction        = fn(this, 'DeleteTransaction',        'apps/backend/src/lambdas/transactions/delete.ts',             txEnv);
const createTransfer           = fn(this, 'CreateTransfer',           'apps/backend/src/lambdas/transactions/transfer.ts',           txEnv);
const bulkUpdateTransactions   = fn(this, 'BulkUpdateTransactions',   'apps/backend/src/lambdas/transactions/bulk-update.ts',        txEnv);
const convertToTransfer        = fn(this, 'ConvertToTransfer',        'apps/backend/src/lambdas/transactions/convert-to-transfer.ts',txEnv);

// ── Analytics (1) ─────────────────────────────────────────────────────────
const getAnalytics = fn(this, 'GetAnalytics', 'apps/backend/src/lambdas/analytics/get.ts', { TABLE_NAME: transactionsTable.tableName });
```

Grant DynamoDB permissions (replace old blanket grants with per-Lambda grants):

```typescript
[createAccount, listAccounts, getAccount, updateAccount, deleteAccount].forEach(f => accountsTable.grantReadWriteData(f));
[createCategory, listCategories, getCategory, updateCategory, deleteCategory].forEach(f => categoriesTable.grantReadWriteData(f));
[createBudget, listBudget, getBudget, updateBudget, deleteBudget].forEach(f => budgetTable.grantReadWriteData(f));
budgetComparison.grantPrincipal && budgetTable.grantReadWriteData(budgetComparison);
transactionsTable.grantReadData(budgetComparison);
[createTransaction, listTransactions, getTransaction, updateTransaction,
 deleteTransaction, createTransfer, bulkUpdateTransactions, convertToTransfer].forEach(f => transactionsTable.grantReadWriteData(f));
transactionsTable.grantReadData(getAnalytics);
```

Replace API Gateway Lambda integrations — wire each route to the specific Lambda:

```typescript
// Accounts
const accountsResource = api.root.addResource('accounts');
accountsResource.addMethod('GET',  new apigateway.LambdaIntegration(listAccounts));
accountsResource.addMethod('POST', new apigateway.LambdaIntegration(createAccount));
const accountResource = accountsResource.addResource('{accountId}');
accountResource.addMethod('GET',    new apigateway.LambdaIntegration(getAccount));
accountResource.addMethod('PUT',    new apigateway.LambdaIntegration(updateAccount));
accountResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteAccount));

// Categories
const categoriesResource = api.root.addResource('categories');
categoriesResource.addMethod('GET',  new apigateway.LambdaIntegration(listCategories));
categoriesResource.addMethod('POST', new apigateway.LambdaIntegration(createCategory));
const categoryResource = categoriesResource.addResource('{categoryId}');
categoryResource.addMethod('GET',    new apigateway.LambdaIntegration(getCategory));
categoryResource.addMethod('PUT',    new apigateway.LambdaIntegration(updateCategory));
categoryResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteCategory));

// Budget
const budgetResource = api.root.addResource('budget');
budgetResource.addMethod('GET',  new apigateway.LambdaIntegration(listBudget));
budgetResource.addMethod('POST', new apigateway.LambdaIntegration(createBudget));
const budgetComparisonResource = budgetResource.addResource('comparison');
budgetComparisonResource.addMethod('GET', new apigateway.LambdaIntegration(budgetComparison));
const budgetItemResource = budgetResource.addResource('{budgetId}');
budgetItemResource.addMethod('GET',    new apigateway.LambdaIntegration(getBudget));
budgetItemResource.addMethod('PUT',    new apigateway.LambdaIntegration(updateBudget));
budgetItemResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteBudget));

// Transactions
const transactionsResource = api.root.addResource('transactions');
transactionsResource.addMethod('GET',  new apigateway.LambdaIntegration(listTransactions));
transactionsResource.addMethod('POST', new apigateway.LambdaIntegration(createTransaction));
const transferResource = transactionsResource.addResource('transfer');
transferResource.addMethod('POST', new apigateway.LambdaIntegration(createTransfer));
const bulkUpdateResource = transactionsResource.addResource('bulkUpdate');
bulkUpdateResource.addMethod('POST', new apigateway.LambdaIntegration(bulkUpdateTransactions));
const transactionResource = transactionsResource.addResource('{transactionId}');
transactionResource.addMethod('GET',    new apigateway.LambdaIntegration(getTransaction));
transactionResource.addMethod('PUT',    new apigateway.LambdaIntegration(updateTransaction));
transactionResource.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTransaction));
const convertResource = transactionResource.addResource('convert-to-transfer');
convertResource.addMethod('PUT', new apigateway.LambdaIntegration(convertToTransfer));

// Analytics
const analyticsResource = api.root.addResource('analytics');
analyticsResource.addMethod('GET', new apigateway.LambdaIntegration(getAnalytics));
```

**Step 2: Verify CDK synth succeeds**

```bash
npx cdk synth --quiet 2>&1 | tail -10
```

Expected: no errors.

**Step 3: Commit**

```bash
git add apps/backend/src/backend-stack.ts
git commit -m "feat: update CDK stack with 25 per-operation lambda constructs"
```

---

### Task 11: Delete old handler files

**Files:**
- Delete: `apps/backend/src/assets/lambdas/accounts-handler.ts`
- Delete: `apps/backend/src/assets/lambdas/transactions-handler.ts`
- Delete: `apps/backend/src/assets/lambdas/categories-handler.ts`
- Delete: `apps/backend/src/assets/lambdas/budget-handler.ts`
- Delete: `apps/backend/src/assets/lambdas/analytics-handler.ts`
- Delete dir: `apps/backend/src/assets/` (if empty)

**Step 1: Delete old files**

```bash
rm -rf apps/backend/src/assets
```

**Step 2: Verify no remaining references**

```bash
grep -r "assets/lambdas" apps/backend/src/ 2>/dev/null
```

Expected: no output.

**Step 3: Run full test suite**

```bash
npx nx test @budget-app/backend 2>&1 | tail -20
```

Expected: all tests PASS.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove old monolithic handler files"
```

---

### Task 12: Update CLAUDE.md files

**Files:**
- Modify: `CLAUDE.md` (root)
- Modify: `apps/backend/CLAUDE.md`
- Modify: `apps/backend-e2e/CLAUDE.md`

**Step 1: Update root CLAUDE.md** — change the project table to show `apps/backend/` and `apps/backend-e2e/` instead of `backend/` and `backend-e2e/`.

**Step 2: Update apps/backend/CLAUDE.md** — update:
- Source layout to show `lambdas/<resource>/<operation>.ts` structure
- Remove reference to `assets/lambdas/`
- Update Lambda handler pattern section to describe single-operation exports
- Add shared utilities section
- Update Lambda count to 25

**Step 3: Update apps/backend-e2e/CLAUDE.md** — update path references.

**Step 4: Commit**

```bash
git add CLAUDE.md apps/backend/CLAUDE.md apps/backend-e2e/CLAUDE.md
git commit -m "docs: update CLAUDE.md files after backend refactor"
```

---

### Task 13: Final verification

**Step 1: Run all tests**

```bash
npx nx run-many -t test 2>&1 | tail -20
```

Expected: all pass.

**Step 2: Run CDK synth**

```bash
npx cdk synth --quiet 2>&1 | tail -5
```

Expected: no errors.

**Step 3: Run linting**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no errors (fix any unused variable warnings).

**Step 4: Commit any lint fixes, then done**

```bash
git add -A
git commit -m "fix: lint errors after backend refactor" --allow-empty
```
