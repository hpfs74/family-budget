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

    for (const tx of transactions) {
      const amount = tx.amount ?? 0;
      const cat = tx.category ?? 'uncategorized';

      if (!byCategory[cat]) {
        byCategory[cat] = { income: 0, expenses: 0 };
      }

      if (amount > 0) {
        totalIncome += amount;
        byCategory[cat].income += amount;
      } else {
        totalExpenses += Math.abs(amount);
        byCategory[cat].expenses += Math.abs(amount);
      }
    }

    return ok({
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netBalance: Math.round((totalIncome - totalExpenses) * 100) / 100,
      byCategory,
      transactionCount: transactions.length,
    });
  } catch (error) {
    log.error('getAnalytics error', { error });
    return internalError();
  }
};
