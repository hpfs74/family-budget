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
  account: 'acc-123',
  date: '2024-01-15',
  description: 'Grocery shopping',
  currency: 'GBP',
  amount: -45.50,
};

beforeEach(() => ddbMock.reset());

describe('POST /transactions — create', () => {
  it('creates a transaction and returns 201 with transactionId and timestamps', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(makeEvent(validPayload) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.transactionId).toBeDefined();
    expect(body.account).toBe('acc-123');
    expect(body.description).toBe('Grocery shopping');
    expect(body.createdAt).toBeDefined();
    expect(body.updatedAt).toBeDefined();
  });

  it('returns 400 when account is missing', async () => {
    const { account: _account, ...rest } = validPayload;
    const result = await handler(makeEvent(rest) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/account/i);
  });

  it('returns 400 when description is missing', async () => {
    const { description: _desc, ...rest } = validPayload;
    const result = await handler(makeEvent(rest) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/description/i);
  });

  it('returns 400 for invalid date format', async () => {
    const result = await handler(makeEvent({ ...validPayload, date: '15-01-2024' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/date/i);
  });
});
