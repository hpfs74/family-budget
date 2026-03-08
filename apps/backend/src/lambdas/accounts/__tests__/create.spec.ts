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
  accountName: 'Main Current',
  accountNumber: '12345678',
  bankName: 'HSBC',
  accountType: 'CHECKING',
  currency: 'GBP',
};

beforeEach(() => ddbMock.reset());

describe('POST /accounts — create', () => {
  it('creates an account and returns 201 with accountId', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(makeEvent(validPayload) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.accountId).toBeDefined();
    expect(body.accountName).toBe('Main Current');
    expect(body.isActive).toBe(true);
    expect(body.createdAt).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const result = await handler(makeEvent({}) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 for invalid accountType', async () => {
    const result = await handler(makeEvent({ ...validPayload, accountType: 'INVALID' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/accountType/i);
  });

  it('returns 400 for invalid currency', async () => {
    const result = await handler(makeEvent({ ...validPayload, currency: 'USD' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when body is null', async () => {
    const result = await handler({ body: null } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
