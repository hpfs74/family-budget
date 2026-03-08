import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);

import { handler } from '../convert-to-transfer';

const makeEvent = (transactionId: string | null, body: unknown): Partial<APIGatewayProxyEvent> => ({
  body: JSON.stringify(body),
  pathParameters: transactionId ? { transactionId } : null,
  queryStringParameters: null,
});

const existingTransaction = {
  account: 'acc-123',
  transactionId: 'tx-456',
  date: '2024-01-15',
  description: 'Coffee shop',
  currency: 'GBP',
  amount: -5.50,
  type: 'expense',
};

beforeEach(() => ddbMock.reset());

describe('POST /transactions/{transactionId}/convert-to-transfer — convertToTransfer', () => {
  it('converts an existing transaction to transfer type and returns 200', async () => {
    ddbMock.on(GetCommand).resolves({ Item: existingTransaction });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { ...existingTransaction, type: 'transfer', toAccount: 'acc-789', updatedAt: '2024-01-15T10:00:00.000Z' },
    });
    const result = await handler(makeEvent('tx-456', { account: 'acc-123', toAccount: 'acc-789' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.type).toBe('transfer');
    expect(body.toAccount).toBe('acc-789');
  });

  it('returns 404 when transaction does not exist', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await handler(makeEvent('tx-nonexistent', { account: 'acc-123', toAccount: 'acc-789' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toMatch(/not found/i);
  });

  it('returns 400 when toAccount is missing from body', async () => {
    const result = await handler(makeEvent('tx-456', { account: 'acc-123' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/toAccount/i);
  });
});
