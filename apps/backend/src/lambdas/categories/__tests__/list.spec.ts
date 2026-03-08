import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../list';

beforeEach(() => ddbMock.reset());

describe('GET /categories — list', () => {
  it('returns all categories', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ categoryId: 'c1' }], Count: 1 });
    const result = await handler({ queryStringParameters: null } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.categories).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  it('filters by isActive when provided', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [], Count: 0 });
    await handler({ queryStringParameters: { isActive: 'true' } } as unknown as APIGatewayProxyEvent);
    const calls = ddbMock.commandCalls(ScanCommand);
    expect(calls[0].args[0].input.FilterExpression).toContain('isActive');
  });
});
