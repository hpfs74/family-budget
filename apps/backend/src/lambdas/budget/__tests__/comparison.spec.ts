import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';

const ddbMock = mockClient(DynamoDBDocumentClient);
import { handler } from '../comparison';

beforeEach(() => ddbMock.reset());

const makeEvent = (qs: Record<string, string>): Partial<APIGatewayProxyEvent> => ({
  queryStringParameters: qs,
});

const budgetItem = {
  budgetId: 'b1',
  categoryId: 'cat1',
  amount: 300,
  type: 'monthly',
  startMonth: '2026-01',
  endMonth: '2026-12',
  year: 2026,
  isActive: true,
};

const transaction = {
  account: 'acc1',
  transactionId: 't1',
  date: '2026-03-15',
  category: 'cat1',
  amount: -250,
};

describe('GET /budget/comparison', () => {
  it('returns monthly comparison with correct planned, actual, delta', async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [budgetItem] })
      .resolvesOnce({ Items: [transaction] });

    const result = await handler(makeEvent({ year: '2026', month: '03' }) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(200);

    const body = JSON.parse(result.body);
    expect(body.months).toHaveLength(1);
    const march = body.months[0];
    expect(march.month).toBe('2026-03');
    expect(march.totalPlanned).toBe(300);
    expect(march.totalActual).toBe(250);
    expect(march.categories[0].categoryId).toBe('cat1');
    expect(march.categories[0].planned).toBe(300);
    expect(march.categories[0].actual).toBe(250);
    expect(march.categories[0].delta).toBe(50);
  });

  it('returns delta = planned when no transactions exist', async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [budgetItem] })
      .resolvesOnce({ Items: [] });

    const result = await handler(makeEvent({ year: '2026', month: '01' }) as APIGatewayProxyEvent);
    const body = JSON.parse(result.body);
    expect(body.months[0].categories[0].delta).toBe(300);
    expect(body.months[0].totalActual).toBe(0);
  });

  it('returns empty categories when no budget items exist', async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [] })
      .resolvesOnce({ Items: [] });

    const result = await handler(makeEvent({ year: '2026', month: '01' }) as APIGatewayProxyEvent);
    const body = JSON.parse(result.body);
    expect(body.months[0].categories).toHaveLength(0);
    expect(body.months[0].totalPlanned).toBe(0);
  });

  it('returns 12 months when no month filter provided', async () => {
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [] })
      .resolvesOnce({ Items: [] });

    const result = await handler(makeEvent({ year: '2026' }) as APIGatewayProxyEvent);
    const body = JSON.parse(result.body);
    expect(body.months).toHaveLength(12);
  });

  it('does not count one-time budget items outside their startMonth', async () => {
    const oneTimeItem = { ...budgetItem, type: 'one-time', startMonth: '2026-01', endMonth: '2026-01' };
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [oneTimeItem] })
      .resolvesOnce({ Items: [] });

    // March — one-time item was only for January
    const result = await handler(makeEvent({ year: '2026', month: '03' }) as APIGatewayProxyEvent);
    const body = JSON.parse(result.body);
    expect(body.months[0].totalPlanned).toBe(0);
  });

  it('counts one-time budget item in its startMonth', async () => {
    const oneTimeItem = { ...budgetItem, amount: 500, type: 'one-time', startMonth: '2026-01', endMonth: '2026-01' };
    ddbMock
      .on(ScanCommand)
      .resolvesOnce({ Items: [oneTimeItem] })
      .resolvesOnce({ Items: [] });

    const result = await handler(makeEvent({ year: '2026', month: '01' }) as APIGatewayProxyEvent);
    const body = JSON.parse(result.body);
    expect(body.months[0].totalPlanned).toBe(500);
  });

  it('returns 400 when year query param is missing', async () => {
    const result = await handler(makeEvent({}) as APIGatewayProxyEvent);
    expect(result.statusCode).toBe(400);
  });
});
