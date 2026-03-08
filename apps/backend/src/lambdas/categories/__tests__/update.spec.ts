import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../update';

beforeEach(() => ddbMock.reset());

describe('PUT /categories/:categoryId — update', () => {
  it('updates and returns the category', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { categoryId: 'c1', name: 'Updated' } });
    const result = await handler({
      pathParameters: { categoryId: 'c1' },
      body: JSON.stringify({ name: 'Updated' }),
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
  });

  it('returns 400 when body is empty object', async () => {
    const result = await handler({
      pathParameters: { categoryId: 'c1' },
      body: '{}',
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when categoryId missing', async () => {
    const result = await handler({
      pathParameters: null,
      body: JSON.stringify({ name: 'X' }),
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
