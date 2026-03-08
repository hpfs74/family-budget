import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';
import AWSXRay from 'aws-xray-sdk-core';
import log from 'lambda-log';

// Capture AWS SDK calls with X-Ray
const client = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'BankTransactions';

interface Transaction {
  account: string;
  transactionId: string;
  date: string;
  description: string;
  currency: 'GBP' | 'EUR';
  amount: number;
  fee: number;
  category: string;
}

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

interface CategoryData {
  category: string;
  amount: number;
  percentage: number;
}

interface AnalyticsData {
  monthlyTrends: MonthlyData[];
  categoryBreakdown: CategoryData[];
  summary: {
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    transactionCount: number;
  };
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const method = event.httpMethod;
    const path = event.path;

    switch (method) {
      case 'OPTIONS':
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: ''
        };

      case 'GET':
        if (path === '/analytics') {
          return await getAnalytics(event);
        }
        break;

      default:
        return {
          statusCode: 405,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    log.error('Analytics handler error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function getAnalytics(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const queryParams = event.queryStringParameters || {};
  const account = queryParams.account;

  if (!account) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'account parameter is required' })
    };
  }

  // Get all transactions for the account
  const command = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'account = :account',
    ExpressionAttributeValues: {
      ':account': account
    }
  });

  const result = await docClient.send(command);
  const transactions = (result.Items || []) as Transaction[];

  // Calculate 12-month trends
  const monthlyTrends = calculateMonthlyTrends(transactions);

  // Calculate category breakdown
  const categoryBreakdown = calculateCategoryBreakdown(transactions);

  // Calculate summary
  const summary = calculateSummary(transactions);

  const analytics: AnalyticsData = {
    monthlyTrends,
    categoryBreakdown,
    summary
  };

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(analytics)
  };
}

function calculateMonthlyTrends(transactions: Transaction[]): MonthlyData[] {
  const monthlyData = new Map<string, { income: number; expenses: number }>();

  // Initialize last 12 months
  const currentDate = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() - i);
    const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
    monthlyData.set(monthKey, { income: 0, expenses: 0 });
  }

  // Process transactions
  transactions.forEach(transaction => {
    const transactionDate = new Date(transaction.date);
    const monthKey = transactionDate.toISOString().slice(0, 7);

    if (monthlyData.has(monthKey)) {
      const data = monthlyData.get(monthKey)!;
      const amount = Math.abs(transaction.amount);

      if (transaction.amount > 0) {
        data.income += amount;
      } else {
        data.expenses += amount;
      }
    }
  });

  // Convert to array format
  return Array.from(monthlyData.entries()).map(([month, data]) => ({
    month: formatMonthLabel(month),
    income: Math.round(data.income * 100) / 100,
    expenses: Math.round(data.expenses * 100) / 100
  }));
}

function calculateCategoryBreakdown(transactions: Transaction[]): CategoryData[] {
  const categoryTotals = new Map<string, number>();
  let totalExpenses = 0;

  // Calculate totals per category (only expenses, not income)
  transactions.forEach(transaction => {
    if (transaction.amount < 0) { // Only expenses
      const amount = Math.abs(transaction.amount);
      const current = categoryTotals.get(transaction.category) || 0;
      categoryTotals.set(transaction.category, current + amount);
      totalExpenses += amount;
    }
  });

  // Convert to array with percentages
  const breakdown = Array.from(categoryTotals.entries()).map(([category, amount]) => ({
    category,
    amount: Math.round(amount * 100) / 100,
    percentage: totalExpenses > 0 ? Math.round((amount / totalExpenses) * 10000) / 100 : 0
  }));

  // Sort by amount descending
  return breakdown.sort((a, b) => b.amount - a.amount);
}

function calculateSummary(transactions: Transaction[]): AnalyticsData['summary'] {
  let totalIncome = 0;
  let totalExpenses = 0;

  transactions.forEach(transaction => {
    const amount = Math.abs(transaction.amount);
    if (transaction.amount > 0) {
      totalIncome += amount;
    } else {
      totalExpenses += amount;
    }
  });

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    balance: Math.round((totalIncome - totalExpenses) * 100) / 100,
    transactionCount: transactions.length
  };
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}