import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../list';

beforeEach(() => ddbMock.reset());

describe('GET /budget — list', () => {
  it('returns items for current year by default', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [{ budgetId: 'b1' }], Count: 1 });
    const result = await handler({ queryStringParameters: null } as unknown as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.items).toHaveLength(1);
    const scan = ddbMock.commandCalls(ScanCommand)[0];
    expect(scan.args[0].input.ExpressionAttributeValues?.[':year']).toBe(new Date().getFullYear());
  });

  it('filters by provided year', async () => {
    ddbMock.on(ScanCommand).resolves({ Items: [], Count: 0 });
    await handler({ queryStringParameters: { year: '2025' } } as unknown as APIGatewayProxyEvent);
    const scan = ddbMock.commandCalls(ScanCommand)[0];
    expect(scan.args[0].input.ExpressionAttributeValues?.[':year']).toBe(2025);
  });
});
