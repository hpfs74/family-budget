import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
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
  it('converts an existing transaction to transfer type and returns 200 (no matching dest → auto-creates)', async () => {
    ddbMock.on(GetCommand).resolves({ Item: existingTransaction });
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { ...existingTransaction, transferType: 'outgoing', relatedAccount: 'acc-789', updatedAt: '2024-01-15T10:00:00.000Z' },
    });
    const result = await handler(makeEvent('tx-456', { account: 'acc-123', toAccount: 'acc-789' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.source).toBeDefined();
    expect(body.source.transferType).toBe('outgoing');
    expect(body.source.relatedAccount).toBe('acc-789');
    expect(body.matched).toBe(false);
    expect(body.autoCreated).toBe(true);
    expect(body.destination).toBeDefined();
    expect(body.destination.account).toBe('acc-789');
    expect(body.destination.transferType).toBe('incoming');
    expect(body.destination.amount).toBe(5.50); // positive
  });

  it('converts and links to existing matching destination transaction', async () => {
    const destTransaction = { account: 'acc-789', transactionId: 'tx-dest', date: '2024-01-15', description: 'Transfer', amount: 5.50, currency: 'GBP', fee: 0 };
    ddbMock.on(GetCommand).resolves({ Item: existingTransaction });
    ddbMock.on(QueryCommand).resolves({ Items: [destTransaction] });
    ddbMock.on(UpdateCommand).resolves({
      Attributes: { ...existingTransaction, transferType: 'outgoing', relatedAccount: 'acc-789' },
    });
    const result = await handler(makeEvent('tx-456', { account: 'acc-123', toAccount: 'acc-789' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.matched).toBe(true);
    expect(body.autoCreated).toBe(false);
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
