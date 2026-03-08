import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../update';

beforeEach(() => ddbMock.reset());

describe('PUT /accounts/:accountId — update', () => {
  it('updates and returns the account', async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { accountId: 'a1', accountName: 'Updated' } });
    const result = await handler({
      pathParameters: { accountId: 'a1' },
      body: JSON.stringify({ accountName: 'Updated' }),
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
  });

  it('returns 400 when body is empty object', async () => {
    const result = await handler({
      pathParameters: { accountId: 'a1' },
      body: '{}',
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });

  it('returns 400 when accountId missing', async () => {
    const result = await handler({
      pathParameters: null,
      body: JSON.stringify({ accountName: 'X' }),
    } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
