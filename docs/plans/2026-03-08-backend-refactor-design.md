# Backend Refactor Design

## Goal

Restructure the backend into a clean, well-tested, per-operation Lambda architecture with shared utilities, Zod validation, and meaningful test coverage — especially for the budget feature.

## Scope

Four parallel concerns addressed together:
1. Move `backend/` and `backend-e2e/` into `apps/`
2. Split each resource handler into one Lambda per HTTP operation (~25 Lambdas total)
3. Extract shared utilities into `apps/backend/src/shared/`
4. Add Zod schema validation + `aws-sdk-client-mock` unit tests

---

## 1. Directory Structure

```
apps/
  backend/
    src/
      main.ts
      backend-stack.ts
      certificate-stack.ts
      frontend-stack.ts
      shared/
        db.ts              # DynamoDB client + X-Ray
        response.ts        # CORS headers, typed response builders
        validation.ts      # Zod parse helper returning typed result
      lambdas/
        accounts/
          schema.ts
          create.ts  list.ts  get.ts  update.ts  delete.ts
          __tests__/
            create.spec.ts  list.spec.ts  get.spec.ts
            update.spec.ts  delete.spec.ts
        transactions/
          schema.ts
          create.ts  list.ts  get.ts  update.ts  delete.ts
          transfer.ts  bulk-update.ts  convert-to-transfer.ts
          __tests__/
            create.spec.ts  transfer.spec.ts  convert-to-transfer.spec.ts
        categories/
          schema.ts
          create.ts  list.ts  get.ts  update.ts  delete.ts
          __tests__/
            create.spec.ts  list.spec.ts
        budget/
          schema.ts
          create.ts  list.ts  get.ts  update.ts  delete.ts  comparison.ts
          __tests__/
            create.spec.ts  list.spec.ts  get.spec.ts
            update.spec.ts  delete.spec.ts  comparison.spec.ts
        analytics/
          get.ts
          __tests__/
            get.spec.ts
  backend-e2e/
    src/backend/backend.spec.ts
```

**References updated:** `cdk.json`, `nx.json`, root `package.json` workspaces,
`apps/backend/project.json`, all CLAUDE.md files, CI pipeline.

---

## 2. Lambda Structure (per operation)

Each file exports a single `handler`. No routing switch. ~30–50 lines per file.

```typescript
// lambdas/accounts/create.ts
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const parsed = validate(CreateAccountSchema, JSON.parse(event.body ?? '{}'));
  if (!parsed.success) return parsed.response;
  const account = { accountId: uuidv4(), ...parsed.data, createdAt: now, updatedAt: now };
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: account }));
  return created(account);
};
```

### Shared utilities

**`shared/db.ts`**
```typescript
export const docClient = DynamoDBDocumentClient.from(
  AWSXRay.captureAWSv3Client(new DynamoDBClient({}))
);
```

**`shared/response.ts`**
```typescript
export const ok = (body: unknown) => ({ statusCode: 200, headers: corsHeaders, body: JSON.stringify(body) });
export const created = (body: unknown) => ({ statusCode: 201, headers: corsHeaders, body: JSON.stringify(body) });
export const badRequest = (message: string) => ({ statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: message }) });
export const notFound = (message: string) => ({ statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: message }) });
export const noContent = () => ({ statusCode: 204, headers: corsHeaders, body: '' });
export const internalError = () => ({ statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Internal server error' }) });
```

**`shared/validation.ts`**
```typescript
export const validate = <T>(schema: ZodSchema<T>, data: unknown):
  { success: true; data: T } | { success: false; response: APIGatewayProxyResult } => {
  const result = schema.safeParse(data);
  if (!result.success) return { success: false, response: badRequest(result.error.issues.map(i => i.message).join(', ')) };
  return { success: true, data: result.data };
};
```

### CDK `backend-stack.ts`

25 `NodejsFunction` constructs, one per operation. DRY helper:
```typescript
const fn = (id: string, entry: string, env: Record<string, string>) =>
  new NodejsFunction(this, id, { ...defaultFunctionProps(entry), environment: env });
```

Lambda entry paths change from `backend/src/assets/lambdas/*.ts`
to `apps/backend/src/lambdas/<resource>/<operation>.ts`.

---

## 3. Zod Validation

Schemas co-located in `schema.ts` per resource. Inferred TypeScript types eliminate
the separate interface definitions.

**Accounts:**
```typescript
export const CreateAccountSchema = z.object({
  accountName: z.string().min(1),
  accountNumber: z.string().min(1),
  bankName: z.string().min(1),
  accountType: z.enum(['CHECKING', 'SAVINGS', 'CREDIT', 'INVESTMENT']),
  currency: z.enum(['GBP', 'EUR']),
  balance: z.number().optional(),
  isActive: z.boolean().default(true),
});
export const UpdateAccountSchema = CreateAccountSchema.partial();
export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;
```

**Budget (most complex):**
```typescript
export const CreateBudgetSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.enum(['GBP', 'EUR']),
  type: z.enum(['monthly', 'periodic', 'one-time']),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/),
  endMonth: z.string().regex(/^\d{4}-\d{2}$/),
  year: z.number().int().min(2000).max(2100),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});
export const UpdateBudgetSchema = CreateBudgetSchema.partial();
export const BudgetComparisonQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/).transform(Number),
  month: z.string().regex(/^\d{2}$/).optional(),
});
```

---

## 4. Test Strategy

Library: `aws-sdk-client-mock` (`mockClient(DynamoDBDocumentClient)`).

**Pattern:**
```typescript
const ddbMock = mockClient(DynamoDBDocumentClient);
beforeEach(() => ddbMock.reset());

it('creates and returns 201', async () => {
  ddbMock.on(PutCommand).resolves({});
  const result = await handler({ body: JSON.stringify({...validPayload}) } as any);
  expect(result.statusCode).toBe(201);
  const body = JSON.parse(result.body);
  expect(body.accountId).toBeDefined();
});

it('returns 400 for missing required fields', async () => {
  const result = await handler({ body: '{}' } as any);
  expect(result.statusCode).toBe(400);
});
```

**Budget `comparison.spec.ts`** specifically covers:
- Correct planned vs actual aggregation per category/month
- Empty transactions → delta equals full planned amount
- No budget items → empty comparison result
- Partial month filtering

**Coverage target:** Every Lambda: happy path + invalid input (400) + not-found (404) where applicable.

---

## Lambda Count

| Resource     | Operations                                                        | Count |
|--------------|-------------------------------------------------------------------|-------|
| accounts     | create, list, get, update, delete                                 | 5     |
| transactions | create, list, get, update, delete, transfer, bulk-update, convert | 8     |
| categories   | create, list, get, update, delete                                 | 5     |
| budget       | create, list, get, update, delete, comparison                     | 6     |
| analytics    | get                                                               | 1     |
| **Total**    |                                                                   | **25**|
