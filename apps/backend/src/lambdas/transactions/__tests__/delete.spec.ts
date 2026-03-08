import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);

import { handler } from '../delete';

const makeEvent = (transactionId: string | null, account: string | null): Partial<APIGatewayProxyEvent> => ({
  body: null,
  pathParameters: transactionId ? { transactionId } : null,
  queryStringParameters: account ? { account } : null,
});

const existingItem = {
  account: 'acc-123',
  transactionId: 'tx-456',
  description: 'Coffee',
  amount: -3.50,
};

beforeEach(() => ddbMock.reset());

describe('DELETE /transactions/{transactionId} — delete', () => {
  it('returns 204 on successful deletion', async () => {
    ddbMock.on(GetCommand).resolves({ Item: existingItem });
    ddbMock.on(DeleteCommand).resolves({});
    const result = await handler(makeEvent('tx-456', 'acc-123') as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(204);
    expect(result.body).toBe('');
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
