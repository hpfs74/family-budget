import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../update';

beforeEach(() => ddbMock.reset());

describe('PUT /budget/:budgetId — update', () => {
  it('updates and returns the item', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { budgetId: 'b1', amount: 500 } });
    const result = await handler({
      pathParameters: { budgetId: 'b1' },
      body: JSON.stringify({ amount: 500 }),
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
  });

  it('returns 400 for invalid type in update', async () => {
    const result = await handler({
      pathParameters: { budgetId: 'b1' },
      body: JSON.stringify({ type: 'not-valid' }),
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when no fields provided', async () => {
    const result = await handler({
      pathParameters: { budgetId: 'b1' },
      body: '{}',
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
