import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);

import { handler } from '../list';

const makeEvent = (queryStringParameters: Record<string, string> | null): Partial<APIGatewayProxyEvent> => ({
  body: null,
  pathParameters: null,
  queryStringParameters,
});

const sampleItems = [
  { account: 'acc-123', transactionId: 'tx-1', description: 'Coffee', amount: -3.50, date: '2024-01-15' },
  { account: 'acc-123', transactionId: 'tx-2', description: 'Salary', amount: 3000, date: '2024-01-31' },
];

beforeEach(() => ddbMock.reset());

describe('GET /transactions — list', () => {
  it('returns 200 with transactions array for valid account param', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: sampleItems });
    const result = await handler(makeEvent({ account: 'acc-123' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.transactions).toHaveLength(2);
    expect(body.transactions[0].transactionId).toBe('tx-1');
  });

  it('returns 400 when account param is missing', async () => {
    const result = await handler(makeEvent(null) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/account/i);
  });

  it('uses CategoryIndex GSI when category param is provided', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [sampleItems[0]] });
    const result = await handler(makeEvent({ account: 'acc-123', category: 'food' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input.IndexName).toBe('CategoryIndex');
    expect(calls[0].args[0].input.KeyConditionExpression).toContain('category');
  });

  it('returns 400 for invalid startDate format', async () => {
    const result = await handler(makeEvent({ account: 'acc-123', startDate: '01-15-2024', endDate: '2024-01-31' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/startDate/i);
  });

  it('returns 400 for invalid endDate format', async () => {
    const result = await handler(makeEvent({ account: 'acc-123', startDate: '2024-01-01', endDate: 'not-a-date' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/endDate/i);
  });
});
