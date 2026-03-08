import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../delete';

beforeEach(() => ddbMock.reset());

describe('DELETE /accounts/:accountId — delete', () => {
  it('returns 204 on success', async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const result = await handler({ pathParameters: { accountId: 'a1' } } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(204);
  });

  it('returns 400 when accountId missing', async () => {
    const result = await handler({ pathParameters: null } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
