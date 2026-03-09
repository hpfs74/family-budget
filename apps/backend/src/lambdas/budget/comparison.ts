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
  direction?: 'expense' | 'income';
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

      // Separate planned amounts by direction
      const expensePlanned: Record<string, number> = {};
      const incomePlanned: Record<string, number> = {};

      for (const item of budgetItems) {
        if (monthStr >= item.startMonth && monthStr <= item.endMonth) {
          const isIncome = item.direction === 'income';
          const target = isIncome ? incomePlanned : expensePlanned;

          if (item.type === 'one-time') {
            if (monthStr === item.startMonth) {
              target[item.categoryId] = (target[item.categoryId] ?? 0) + item.amount;
            }
          } else {
            target[item.categoryId] = (target[item.categoryId] ?? 0) + item.amount;
          }
        }
      }

      // Separate actual amounts: expenses (amount < 0), income (amount > 0)
      const expenseActual: Record<string, number> = {};
      const incomeActual: Record<string, number> = {};

      for (const tx of transactions) {
        const txDate = tx['date'] as string;
        if (!txDate?.startsWith(monthStr)) continue;

        const amount = tx['amount'] as number;
        const cat = tx['category'] as string | undefined;

        if (amount < 0) {
          // Expense — skip uncategorized
          if (!cat) continue;
          expenseActual[cat] = (expenseActual[cat] ?? 0) + Math.abs(amount);
        } else if (amount > 0) {
          // Income
          const key = cat || '__uncategorized__';
          incomeActual[key] = (incomeActual[key] ?? 0) + amount;
        }
      }

      // Build expense categories
      const allExpenseCategories = new Set([...Object.keys(expensePlanned), ...Object.keys(expenseActual)]);
      const expenseCategories = Array.from(allExpenseCategories).map(categoryId => {
        const planned = expensePlanned[categoryId] ?? 0;
        const actual = expenseActual[categoryId] ?? 0;
        return { categoryId, planned, actual, delta: planned - actual };
      });

      // Build income categories
      const allIncomeCategories = new Set([...Object.keys(incomePlanned), ...Object.keys(incomeActual)]);
      const incomeCategories = Array.from(allIncomeCategories).map(categoryId => {
        const planned = incomePlanned[categoryId] ?? 0;
        const actual = incomeActual[categoryId] ?? 0;
        return { categoryId, planned, actual, delta: actual - planned };
      });

      // Legacy "categories" field: expense categories only (backward compat)
      const categories = expenseCategories;

      const totalPlannedExpenses = expenseCategories.reduce((s, c) => s + c.planned, 0);
      const totalActualExpenses = expenseCategories.reduce((s, c) => s + c.actual, 0);
      const totalPlannedIncome = incomeCategories.reduce((s, c) => s + c.planned, 0);
      const totalActualIncome = incomeCategories.reduce((s, c) => s + c.actual, 0);

      return {
        month: monthStr,
        categories,
        incomeCategories,
        totalPlanned: totalPlannedExpenses,
        totalActual: totalActualExpenses,
        totalPlannedExpenses,
        totalActualExpenses,
        totalPlannedIncome,
        totalActualIncome,
      };
    });

    return ok({ months: result });
  } catch (error) {
    log.error('getBudgetComparison error', { error });
    return internalError();
  }
};
