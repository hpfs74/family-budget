import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../create';

const validPayload = {
  name: 'Groceries',
  categoryId: 'cat-123',
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
    const result = await handler({ body: JSON.stringify(validPayload) } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.budgetId).toBeDefined();
    expect(body.name).toBe('Groceries');
    expect(body.isActive).toBe(true);
  });

  it('returns 400 when name is missing', async () => {
    const { name: _, ...rest } = validPayload;
    const result = await handler({ body: JSON.stringify(rest) } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/name/i);
  });

  it('returns 400 for invalid type', async () => {
    const result = await handler({ body: JSON.stringify({ ...validPayload, type: 'weekly' }) } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid currency', async () => {
    const result = await handler({ body: JSON.stringify({ ...validPayload, currency: 'USD' }) } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid startMonth format', async () => {
    const result = await handler({ body: JSON.stringify({ ...validPayload, startMonth: '2026/01' }) } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for negative amount', async () => {
    const result = await handler({ body: JSON.stringify({ ...validPayload, amount: -50 }) } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when body is null', async () => {
    const result = await handler({ body: null } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
