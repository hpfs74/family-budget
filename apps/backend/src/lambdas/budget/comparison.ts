import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, internalError } from '../../shared/response';
import { validate } from '../../shared/validation';
import { BudgetComparisonQuerySchema } from './schema';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BudgetPlanner';
const TABLE_NAME_TRANSACTIONS = process.env['TABLE_NAME_TRANSACTIONS'] ?? 'BankTransactions';

interface BudgetItem {
  budgetId: string;
  categoryId: string;
  amount: number;
  type: 'monthly' | 'periodic' | 'one-time';
  startMonth: string;
  endMonth: string;
  year: number;
  isActive: boolean;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const parsed = validate(BudgetComparisonQuerySchema, event.queryStringParameters ?? {});
    if (!parsed.success) return parsed.response;
    const { year, month } = parsed.data;

    const budgetResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: '#yr = :year AND isActive = :active',
      ExpressionAttributeNames: { '#yr': 'year' },
      ExpressionAttributeValues: { ':year': year, ':active': true },
    }));
    const budgetItems = (budgetResult.Items ?? []) as BudgetItem[];

    const startDate = month
      ? `${year}-${String(month).padStart(2, '0')}-01`
      : `${year}-01-01`;
    const endDate = month
      ? `${year}-${String(month).padStart(2, '0')}-31`
      : `${year}-12-31`;

    const txResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME_TRANSACTIONS,
      FilterExpression: '#date BETWEEN :start AND :end',
      ExpressionAttributeNames: { '#date': 'date' },
      ExpressionAttributeValues: { ':start': startDate, ':end': endDate },
    }));
    const transactions = txResult.Items ?? [];

    const months = month
      ? [month]
      : Array.from({ length: 12 }, (_, i) => i + 1);

    const result = months.map(m => {
      const monthStr = `${year}-${String(m).padStart(2, '0')}`;

      const categoryPlanned: Record<string, number> = {};
      for (const item of budgetItems) {
        if (monthStr >= item.startMonth && monthStr <= item.endMonth) {
          if (item.type === 'one-time') {
            if (monthStr === item.startMonth) {
              categoryPlanned[item.categoryId] = (categoryPlanned[item.categoryId] ?? 0) + item.amount;
            }
          } else {
            categoryPlanned[item.categoryId] = (categoryPlanned[item.categoryId] ?? 0) + item.amount;
          }
        }
      }

      const categoryActual: Record<string, number> = {};
      for (const tx of transactions) {
        const txDate = tx['date'] as string;
        if (txDate?.startsWith(monthStr)) {
          const cat = tx['category'] as string;
          categoryActual[cat] = (categoryActual[cat] ?? 0) + Math.abs(tx['amount'] as number);
        }
      }

      const allCategories = new Set([...Object.keys(categoryPlanned), ...Object.keys(categoryActual)]);
      const categories = Array.from(allCategories).map(categoryId => {
        const planned = categoryPlanned[categoryId] ?? 0;
        const actual = categoryActual[categoryId] ?? 0;
        return { categoryId, planned, actual, delta: planned - actual };
      });

      return {
        month: monthStr,
        categories,
        totalPlanned: categories.reduce((s, c) => s + c.planned, 0),
        totalActual: categories.reduce((s, c) => s + c.actual, 0),
      };
    });

    return ok({ months: result });
  } catch (error) {
    log.error('getBudgetComparison error', { error });
    return internalError();
  }
};
