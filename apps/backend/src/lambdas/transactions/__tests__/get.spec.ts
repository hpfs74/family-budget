import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);

import { handler } from '../get';

const makeEvent = (transactionId: string | null, account: string | null): Partial<APIGatewayProxyEvent> => ({
  body: null,
  pathParameters: transactionId ? { transactionId } : null,
  queryStringParameters: account ? { account } : null,
});

const sampleItem = {
  account: 'acc-123',
  transactionId: 'tx-456',
  description: 'Coffee',
  amount: -3.50,
  date: '2024-01-15',
  currency: 'GBP',
};

beforeEach(() => ddbMock.reset());

describe('GET /transactions/{transactionId} — get', () => {
  it('returns 200 with the transaction when found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: sampleItem });
    const result = await handler(makeEvent('tx-456', 'acc-123') as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.transactionId).toBe('tx-456');
    expect(body.description).toBe('Coffee');
  });

  it('returns 404 when transaction does not exist', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await handler(makeEvent('tx-nonexistent', 'acc-123') as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toMatch(/not found/i);
  });

  it('returns 400 when account param is missing', async () => {
    const result = await handler(makeEvent('tx-456', null) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/account/i);
  });
});
