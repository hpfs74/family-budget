import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../delete';

beforeEach(() => ddbMock.reset());

describe('DELETE /budget/:budgetId — delete', () => {
  it('returns 204', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const result = await handler({ pathParameters: { budgetId: 'b1' } } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(204);
  });

  it('returns 400 when budgetId missing', async () => {
    const result = await handler({ pathParameters: null } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
