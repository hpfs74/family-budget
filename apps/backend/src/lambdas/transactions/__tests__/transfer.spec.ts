import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);

import { handler } from '../transfer';

const makeEvent = (body: unknown): Partial<APIGatewayProxyEvent> => ({
  body: JSON.stringify(body),
  pathParameters: null,
  queryStringParameters: null,
});

const validPayload = {
  fromAccount: 'acc-from',
  toAccount: 'acc-to',
  date: '2024-01-15',
  description: 'Transfer funds',
  currency: 'GBP',
  amount: 100,
};

beforeEach(() => ddbMock.reset());

describe('POST /transactions/transfer — transfer', () => {
  it('creates a transfer and returns 201 with debit and credit', async () => {
    ddbMock.on(TransactWriteCommand).resolves({});
    const result = await handler(makeEvent(validPayload) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.debit).toBeDefined();
    expect(body.credit).toBeDefined();
    expect(body.debit.account).toBe('acc-from');
    expect(body.debit.amount).toBe(-100);
    expect(body.credit.account).toBe('acc-to');
    expect(body.credit.amount).toBe(100);
    expect(body.debit.type).toBe('transfer');
    expect(body.credit.type).toBe('transfer');
  });

  it('returns 400 when fromAccount and toAccount are the same', async () => {
    const result = await handler(makeEvent({ ...validPayload, toAccount: 'acc-from' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/different/i);
  });

  it('returns 400 when fromAccount is missing', async () => {
    const { fromAccount: _from, ...rest } = validPayload;
    const result = await handler(makeEvent(rest) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/fromAccount/i);
  });
});
