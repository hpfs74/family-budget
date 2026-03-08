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
  name: 'Food',
  color: '#FF0000',
};

beforeEach(() => ddbMock.reset());

describe('POST /categories — create', () => {
  it('creates a category and returns 201 with categoryId', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(makeEvent(validPayload) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.categoryId).toBeDefined();
    expect(body.name).toBe('Food');
    expect(body.isActive).toBe(true);
    expect(body.createdAt).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const result = await handler(makeEvent({}) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when name is empty string', async () => {
    const result = await handler(makeEvent({ name: '' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/name/i);
  });

  it('returns 400 when body is null', async () => {
    const result = await handler({ body: null } as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('defaults isActive to true when not provided', async () => {
    ddbMock.on(PutCommand).resolves({});
    const result = await handler(makeEvent({ name: 'Transport' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.isActive).toBe(true);
  });
});
