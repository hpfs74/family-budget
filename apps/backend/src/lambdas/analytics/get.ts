import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TRANSACTIONS_TABLE'] ?? 'BankTransactions';

const YEAR_REGEX = /^\d{4}$/;
const MONTH_REGEX = /^\d{2}$/;

interface Transaction {
  account: string;
  transactionId: string;
  date: string;
  amount: number;
  category: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { account, year, month } = event.queryStringParameters ?? {};

    if (!account) return badRequest('account is required');
    if (year && !YEAR_REGEX.test(year)) return badRequest('year must be YYYY');
    if (month && !MONTH_REGEX.test(month)) return badRequest('month must be MM');
    if (month && !year) return badRequest('year is required when month is provided');

    let filterExpression: string | undefined;
    let filterAttributeNames: Record<string, string> | undefined;
    let filterAttributeValues: Record<string, unknown> | undefined;

    if (year) {
      const datePrefix = month ? `${year}-${month}` : year;
      filterExpression = 'begins_with(#date, :datePrefix)';
      filterAttributeNames = { '#date': 'date' };
      filterAttributeValues = { ':datePrefix': datePrefix };
    }

    const command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'account = :account',
      ExpressionAttributeValues: {
        ':account': account,
        ...(filterAttributeValues ?? {}),
      },
      ...(filterExpression ? { FilterExpression: filterExpression } : {}),
      ...(filterAttributeNames ? { ExpressionAttributeNames: filterAttributeNames } : {}),
    });

    const result = await docClient.send(command);
    const transactions = (result.Items ?? []) as Transaction[];

    let totalIncome = 0;
    let totalExpenses = 0;
    const byCategory: Record<string, { income: number; expenses: number }> = {};
    const byMonth: Record<string, { income: number; expenses: number }> = {};

    for (const tx of transactions) {
      const amount = tx.amount ?? 0;
      const cat = tx.category ?? 'uncategorized';
      const monthKey = (tx.date ?? '').slice(0, 7); // YYYY-MM

      if (!byCategory[cat]) byCategory[cat] = { income: 0, expenses: 0 };
      if (!byMonth[monthKey]) byMonth[monthKey] = { income: 0, expenses: 0 };

      if (amount > 0) {
        totalIncome += amount;
        byCategory[cat].income += amount;
        byMonth[monthKey].income += amount;
      } else {
        totalExpenses += Math.abs(amount);
        byCategory[cat].expenses += Math.abs(amount);
        byMonth[monthKey].expenses += Math.abs(amount);
      }
    }

    // Monthly trends sorted chronologically
    const monthlyTrends = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { income, expenses }]) => ({
        month,
        income: Math.round(income * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        net: Math.round((income - expenses) * 100) / 100,
      }));

    // Category breakdown with percentages (expenses only)
    const categoryBreakdown = Object.entries(byCategory)
      .map(([category, { expenses }]) => ({ category, amount: Math.round(expenses * 100) / 100 }))
      .filter(c => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map(c => ({
        ...c,
        percentage: totalExpenses > 0 ? Math.round((c.amount / totalExpenses) * 1000) / 10 : 0,
      }));

    return ok({
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netBalance: Math.round((totalIncome - totalExpenses) * 100) / 100,
      byCategory,
      monthlyTrends,
      categoryBreakdown,
      summary: {
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        balance: Math.round((totalIncome - totalExpenses) * 100) / 100,
        transactionCount: transactions.length,
      },
      transactionCount: transactions.length,
    });
  } catch (error) {
    log.error('getAnalytics error', { error });
    return internalError();
  }
};
