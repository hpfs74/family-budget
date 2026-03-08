import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import AWSXRay from 'aws-xray-sdk-core';
import log from 'lambda-log';

// Capture AWS SDK calls with X-Ray
const client = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'BudgetPlanner';
const TABLE_NAME_TRANSACTIONS = process.env.TABLE_NAME_TRANSACTIONS || 'BankTransactions';

interface BudgetItem {
  budgetId: string;
  name: string;
  categoryId: string;
  amount: number;
  currency: string;
  type: 'monthly' | 'periodic' | 'one-time';
  startMonth: string;
  endMonth: string;
  year: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
        return { statusCode: 200, headers: corsHeaders, body: '' };

      case 'POST':
        if (path === '/budget') {
          return await createBudget(event);
        }
        break;

      case 'GET':
        if (path === '/budget/comparison') {
          return await getBudgetComparison(event);
        } else if (path === '/budget') {
          return await listBudget(event);
        } else if (path.startsWith('/budget/')) {
          return await getBudget(event);
        }
        break;

      case 'PUT':
        if (path.startsWith('/budget/')) {
          return await updateBudget(event);
        }
        break;

      case 'DELETE':
        if (path.startsWith('/budget/')) {
          return await deleteBudget(event);
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
    log.error('Handler error:', { error: error instanceof Error ? error.message : error, stack: error instanceof Error ? error.stack : undefined });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function listBudget(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const queryParams = event.queryStringParameters || {};
  const year = queryParams.year ? parseInt(queryParams.year) : new Date().getFullYear();

  const result = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: '#yr = :year',
    ExpressionAttributeNames: { '#yr': 'year' },
    ExpressionAttributeValues: { ':year': year }
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      items: result.Items || [],
      count: result.Count || 0
    })
  };
}

async function createBudget(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  const data = JSON.parse(event.body);

  if (!data.name || !data.categoryId || data.amount === undefined ||
      !data.currency || !data.type || !data.startMonth || !data.endMonth || data.year === undefined) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing required fields' })
    };
  }

  if (!['monthly', 'periodic', 'one-time'].includes(data.type)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Type must be monthly, periodic, or one-time' })
    };
  }

  if (!['EUR', 'GBP'].includes(data.currency)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Currency must be EUR or GBP' })
    };
  }

  const now = new Date().toISOString();
  const item: BudgetItem = {
    budgetId: uuidv4(),
    name: data.name,
    categoryId: data.categoryId,
    amount: data.amount,
    currency: data.currency,
    type: data.type,
    startMonth: data.startMonth,
    endMonth: data.endMonth,
    year: data.year,
    notes: data.notes,
    isActive: data.isActive !== undefined ? data.isActive : true,
    createdAt: now,
    updatedAt: now
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  }));

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify(item)
  };
}

async function getBudget(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const budgetId = event.pathParameters?.budgetId;

  if (!budgetId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'budgetId is required' })
    };
  }

  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { budgetId }
  }));

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Budget item not found' })
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.Item)
  };
}

async function updateBudget(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const budgetId = event.pathParameters?.budgetId;

  if (!budgetId || !event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'budgetId and request body are required' })
    };
  }

  const updates = JSON.parse(event.body);

  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  Object.keys(updates).forEach((key, index) => {
    if (key !== 'budgetId' && key !== 'createdAt') {
      const attributeName = `#attr${index}`;
      const attributeValue = `:val${index}`;
      updateExpressions.push(`${attributeName} = ${attributeValue}`);
      expressionAttributeNames[attributeName] = key;
      expressionAttributeValues[attributeValue] = updates[key];
    }
  });

  // Always update updatedAt
  updateExpressions.push('#updatedAt = :updatedAt');
  expressionAttributeNames['#updatedAt'] = 'updatedAt';
  expressionAttributeValues[':updatedAt'] = new Date().toISOString();

  if (updateExpressions.length === 1) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'No valid fields to update' })
    };
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { budgetId },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: 'ALL_NEW'
  }));

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.Attributes)
  };
}

async function deleteBudget(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const budgetId = event.pathParameters?.budgetId;

  if (!budgetId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'budgetId is required' })
    };
  }

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { budgetId }
  }));

  return {
    statusCode: 204,
    headers: corsHeaders,
    body: ''
  };
}

async function getBudgetComparison(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const queryParams = event.queryStringParameters || {};
  const year = queryParams.year ? parseInt(queryParams.year) : new Date().getFullYear();
  const month = queryParams.month ? parseInt(queryParams.month) : undefined;

  // Fetch all budget items for the year
  const budgetResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: '#yr = :year AND isActive = :active',
    ExpressionAttributeNames: { '#yr': 'year' },
    ExpressionAttributeValues: { ':year': year, ':active': true }
  }));

  const budgetItems = (budgetResult.Items || []) as BudgetItem[];

  // Fetch transactions for the period
  const startDate = month
    ? `${year}-${String(month).padStart(2, '0')}-01`
    : `${year}-01-01`;
  const endDate = month
    ? `${year}-${String(month).padStart(2, '0')}-31`
    : `${year}-12-31`;

  const transactionsResult = await docClient.send(new ScanCommand({
    TableName: TABLE_NAME_TRANSACTIONS,
    FilterExpression: '#date BETWEEN :startDate AND :endDate',
    ExpressionAttributeNames: { '#date': 'date' },
    ExpressionAttributeValues: { ':startDate': startDate, ':endDate': endDate }
  }));

  const transactions = transactionsResult.Items || [];

  // Determine months to process
  const months: number[] = month ? [month] : Array.from({ length: 12 }, (_, i) => i + 1);

  const result = months.map(m => {
    const monthStr = `${year}-${String(m).padStart(2, '0')}`;

    // Calculate planned per category
    const categoryPlanned: Record<string, number> = {};

    for (const item of budgetItems) {
      if (monthStr >= item.startMonth && monthStr <= item.endMonth) {
        if (item.type === 'one-time') {
          // One-time: only in startMonth, full amount
          if (monthStr === item.startMonth) {
            categoryPlanned[item.categoryId] = (categoryPlanned[item.categoryId] || 0) + item.amount;
          }
        } else {
          // monthly or periodic: amount per month
          categoryPlanned[item.categoryId] = (categoryPlanned[item.categoryId] || 0) + item.amount;
        }
      }
    }

    // Calculate actual per category for this month
    const categoryActual: Record<string, number> = {};
    for (const tx of transactions) {
      const txDate = tx.date as string;
      if (txDate && txDate.startsWith(monthStr)) {
        const cat = tx.category as string;
        const amount = Math.abs(tx.amount as number);
        categoryActual[cat] = (categoryActual[cat] || 0) + amount;
      }
    }

    // Merge categories
    const allCategories = new Set([...Object.keys(categoryPlanned), ...Object.keys(categoryActual)]);
    const categories = Array.from(allCategories).map(categoryId => {
      const planned = categoryPlanned[categoryId] || 0;
      const actual = categoryActual[categoryId] || 0;
      return {
        categoryId,
        planned,
        actual,
        delta: planned - actual
      };
    });

    const totalPlanned = categories.reduce((sum, c) => sum + c.planned, 0);
    const totalActual = categories.reduce((sum, c) => sum + c.actual, 0);

    return {
      month: monthStr,
      categories,
      totalPlanned,
      totalActual
    };
  });

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ months: result })
  };
}
