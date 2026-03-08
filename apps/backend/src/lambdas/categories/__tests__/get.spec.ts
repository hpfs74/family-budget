import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../get';

beforeEach(() => ddbMock.reset());

describe('GET /categories/:categoryId — get', () => {
  it('returns the category when found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { categoryId: 'c1', name: 'Food' } });
    const result = await handler({ pathParameters: { categoryId: 'c1' } } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).name).toBe('Food');
  });

  it('returns 404 when category not found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await handler({ pathParameters: { categoryId: 'missing' } } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(404);
  });

  it('returns 400 when categoryId is missing', async () => {
    const result = await handler({ pathParameters: null } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
