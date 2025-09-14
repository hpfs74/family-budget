import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({});
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

      case 'POST':
        if (path === '/transactions') {
          return await createTransaction(event);
        } else if (path === '/transactions/bulkUpdate') {
          return await bulkUpdateTransactions(event);
        }
        break;

      case 'GET':
        if (path === '/transactions') {
          return await getTransactions(event);
        } else if (path.startsWith('/transactions/')) {
          return await getTransaction(event);
        }
        break;

      case 'PUT':
        if (path.startsWith('/transactions/')) {
          return await updateTransaction(event);
        }
        break;

      case 'DELETE':
        if (path.startsWith('/transactions/')) {
          return await deleteTransaction(event);
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
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function createTransaction(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  const transaction: Omit<Transaction, 'transactionId'> = JSON.parse(event.body);

  // Validate required fields
  if (!transaction.account || !transaction.date || !transaction.description ||
      !transaction.currency || transaction.amount === undefined ||
      transaction.fee === undefined || !transaction.category) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing required fields' })
    };
  }

  // Validate currency
  if (!['GBP', 'EUR'].includes(transaction.currency)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Currency must be GBP or EUR' })
    };
  }

  const transactionId = uuidv4();
  const newTransaction: Transaction = {
    ...transaction,
    transactionId
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: newTransaction
  }));

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify(newTransaction)
  };
}

async function getTransactions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const queryParams = event.queryStringParameters || {};
  const account = queryParams.account;
  const category = queryParams.category;
  const date = queryParams.date;

  if (!account) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'account parameter is required' })
    };
  }

  let command;

  if (category) {
    // Query by category using CategoryIndex
    command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'CategoryIndex',
      KeyConditionExpression: 'account = :account AND category = :category',
      ExpressionAttributeValues: {
        ':account': account,
        ':category': category
      }
    });
  } else if (date) {
    // Query by date using DateIndex
    command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'DateIndex',
      KeyConditionExpression: 'account = :account AND #date = :date',
      ExpressionAttributeNames: {
        '#date': 'date'
      },
      ExpressionAttributeValues: {
        ':account': account,
        ':date': date
      }
    });
  } else {
    // Query all transactions for account
    command = new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'account = :account',
      ExpressionAttributeValues: {
        ':account': account
      }
    });
  }

  const result = await docClient.send(command);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      transactions: result.Items || [],
      count: result.Count || 0
    })
  };
}

async function getTransaction(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParams = event.pathParameters;
  const queryParams = event.queryStringParameters || {};

  if (!pathParams?.transactionId || !queryParams.account) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'transactionId and account parameters are required' })
    };
  }

  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      account: queryParams.account,
      transactionId: pathParams.transactionId
    }
  }));

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Transaction not found' })
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.Item)
  };
}

async function updateTransaction(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParams = event.pathParameters;

  if (!pathParams?.transactionId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'transactionId is required' })
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'request body is required' })
    };
  }

  const updates = JSON.parse(event.body);

  // Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.keys(updates).forEach((key, index) => {
    if (key !== 'account' && key !== 'transactionId') { // Don't allow updating key attributes
      const attributeName = `#attr${index}`;
      const attributeValue = `:val${index}`;

      updateExpressions.push(`${attributeName} = ${attributeValue}`);
      expressionAttributeNames[attributeName] = key;
      expressionAttributeValues[attributeValue] = updates[key];
    }
  });

  if (updateExpressions.length === 0) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'No valid fields to update' })
    };
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: {
      account: updates.account,
      transactionId: pathParams.transactionId
    },
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

async function deleteTransaction(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParams = event.pathParameters;
  const queryParams = event.queryStringParameters || {};

  if (!pathParams?.transactionId || !queryParams.account) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'transactionId and account parameters are required' })
    };
  }

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      account: queryParams.account,
      transactionId: pathParams.transactionId
    }
  }));

  return {
    statusCode: 204,
    headers: corsHeaders,
    body: ''
  };
}

async function bulkUpdateTransactions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  const { account, description, newCategory } = JSON.parse(event.body);

  if (!account || !description || !newCategory) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'account, description, and newCategory are required' })
    };
  }

  try {
    // Query all transactions for the account
    const queryResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'account = :account',
      ExpressionAttributeValues: {
        ':account': account
      }
    }));

    if (!queryResult.Items || queryResult.Items.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'No transactions found for this account',
          updatedCount: 0
        })
      };
    }

    // Filter transactions with matching description
    const matchingTransactions = queryResult.Items.filter(
      item => item.description === description
    );

    if (matchingTransactions.length === 0) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'No transactions found with matching description',
          updatedCount: 0
        })
      };
    }

    // Update transactions in batches (DynamoDB BatchWrite limit is 25 items)
    const batchSize = 25;
    let totalUpdated = 0;

    for (let i = 0; i < matchingTransactions.length; i += batchSize) {
      const batch = matchingTransactions.slice(i, i + batchSize);

      const writeRequests = batch.map(transaction => ({
        PutRequest: {
          Item: {
            ...transaction,
            category: newCategory,
            updatedAt: new Date().toISOString()
          }
        }
      }));

      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: writeRequests
        }
      }));

      totalUpdated += batch.length;
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: `Successfully updated ${totalUpdated} transactions`,
        updatedCount: totalUpdated
      })
    };

  } catch (error) {
    console.error('Error in bulk update:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to bulk update transactions' })
    };
  }
}