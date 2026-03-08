import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../get';

beforeEach(() => ddbMock.reset());

describe('GET /accounts/:accountId — get', () => {
  it('returns the account when found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: { accountId: 'a1', accountName: 'Test' } });
    const result = await handler({ pathParameters: { accountId: 'a1' } } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).accountName).toBe('Test');
  });

  it('returns 404 when account not found', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const result = await handler({ pathParameters: { accountId: 'missing' } } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(404);
  });

  it('returns 400 when accountId is missing', async () => {
    const result = await handler({ pathParameters: null } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
