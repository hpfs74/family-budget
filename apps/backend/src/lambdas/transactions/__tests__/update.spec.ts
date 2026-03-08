import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);

import { handler } from '../update';

const makeEvent = (
  transactionId: string | null,
  account: string | null,
  body: unknown,
): Partial<APIGatewayProxyEvent> => ({
  body: body !== undefined ? JSON.stringify(body) : null,
  pathParameters: transactionId ? { transactionId } : null,
  queryStringParameters: account ? { account } : null,
});

const existingItem = {
  account: 'acc-123',
  transactionId: 'tx-456',
  description: 'Old description',
  amount: -10,
  date: '2024-01-15',
  currency: 'GBP',
};

beforeEach(() => ddbMock.reset());

describe('PUT /transactions/{transactionId} — update', () => {
  it('returns 200 with updated transaction on happy path', async () => {
    ddbMock.on(GetCommand).resolves({ Item: existingItem });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { ...existingItem, description: 'New description', updatedAt: '2024-01-15T12:00:00.000Z' },
    });
    const result = await handler(makeEvent('tx-456', 'acc-123', { description: 'New description' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.description).toBe('New description');
  });

  it('returns 400 when account query param is missing', async () => {
    const result = await handler(makeEvent('tx-456', null, { description: 'New description' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/account/i);
  });

  it('returns 400 when body has no valid fields to update', async () => {
    const result = await handler(makeEvent('tx-456', 'acc-123', {}) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/no valid fields/i);
  });

  it('returns 404 when transaction does not exist', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await handler(makeEvent('tx-nonexistent', 'acc-123', { description: 'New description' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toMatch(/not found/i);
  });
});
