import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);

import { handler } from '../bulk-update';

const makeEvent = (body: unknown): Partial<APIGatewayProxyEvent> => ({
  body: JSON.stringify(body),
  pathParameters: null,
  queryStringParameters: null,
});

const validPayload = {
  account: 'acc-123',
  transactionIds: ['tx-1', 'tx-2', 'tx-3'],
  updates: { category: 'food' },
};

beforeEach(() => ddbMock.reset());

describe('PATCH /transactions/bulk — bulk-update', () => {
  it('returns 200 with { updated, total } on happy path', async () => {
    ddbMock.on(UpdateCommand).resolves({});
    const result = await handler(makeEvent(validPayload) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.updated).toBe(3);
    expect(body.total).toBe(3);
  });

  it('returns 400 when transactionIds is missing', async () => {
    const { transactionIds: _ids, ...rest } = validPayload;
    const result = await handler(makeEvent(rest) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/transactionId/i);
  });

  it('returns 400 when transactionIds is an empty array', async () => {
    const result = await handler(makeEvent({ ...validPayload, transactionIds: [] }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('counts only successful updates when some fail', async () => {
    ddbMock.on(UpdateCommand)
      .resolvesOnce({})
      .rejectsOnce(new Error('DynamoDB error'))
      .resolvesOnce({});
    const result = await handler(makeEvent(validPayload) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.updated).toBe(2);
    expect(body.total).toBe(3);
  });
});
