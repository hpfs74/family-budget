import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);

import { handler } from '../get';

const makeEvent = (queryStringParameters: Record<string, string> | null): Partial<APIGatewayProxyEvent> => ({
  body: null,
  pathParameters: null,
  queryStringParameters,
});

const sampleTransactions = [
  { account: 'acc-1', transactionId: 'tx-1', date: '2025-01-15', amount: 3000, category: 'salary' },
  { account: 'acc-1', transactionId: 'tx-2', date: '2025-01-20', amount: -50, category: 'food' },
  { account: 'acc-1', transactionId: 'tx-3', date: '2025-02-05', amount: -200, category: 'food' },
  { account: 'acc-1', transactionId: 'tx-4', date: '2025-02-10', amount: 500, category: 'freelance' },
];

beforeEach(() => ddbMock.reset());

describe('GET /analytics', () => {
  it('returns 200 with correct totals for account only', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: sampleTransactions });

    const result = await handler(makeEvent({ account: 'acc-1' }) as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.totalIncome).toBe(3500);
    expect(body.totalExpenses).toBe(250);
    expect(body.netBalance).toBe(3250);
    expect(body.transactionCount).toBe(4);
  });

  it('returns 200 filtered by year with only matching transactions', async () => {
    const yearTransactions = sampleTransactions.filter(tx => tx.date.startsWith('2025-01'));
    ddbMock.on(QueryCommand).resolves({ Items: yearTransactions });

    const result = await handler(makeEvent({ account: 'acc-1', year: '2025' }) as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    // Only Jan transactions: +3000 income, -50 expenses
    expect(body.totalIncome).toBe(3000);
    expect(body.totalExpenses).toBe(50);
    expect(body.netBalance).toBe(2950);
    expect(body.transactionCount).toBe(2);

    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls[0].args[0].input.FilterExpression).toContain('begins_with');
  });

  it('returns 400 when account param is missing', async () => {
    const result = await handler(makeEvent(null) as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/account/i);
  });

  it('returns 400 for invalid year format', async () => {
    const result = await handler(makeEvent({ account: 'acc-1', year: '25' }) as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).error).toMatch(/year/i);
  });

  it('returns correct byCategory aggregation', async () => {
    ddbMock.on(QueryCommand).resolves({ Items: sampleTransactions });

    const result = await handler(makeEvent({ account: 'acc-1' }) as APIGatewayProxyEvent);

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.byCategory.salary).toEqual({ income: 3000, expenses: 0 });
    expect(body.byCategory.food).toEqual({ income: 0, expenses: 250 });
    expect(body.byCategory.freelance).toEqual({ income: 500, expenses: 0 });
  });
});
