import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../get';

beforeEach(() => ddbMock.reset());

describe('GET /budget/:budgetId — get', () => {
  it('returns the budget item', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { budgetId: 'b1', name: 'Groceries' } });
    const result = await handler({ pathParameters: { budgetId: 'b1' } } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).name).toBe('Groceries');
  });

  it('returns 404 when not found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await handler({ pathParameters: { budgetId: 'missing' } } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(404);
  });

  it('returns 400 when budgetId missing', async () => {
    const result = await handler({ pathParameters: null } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
