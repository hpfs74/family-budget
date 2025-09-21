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

// Capture AWS SDK calls with X-Ray
const client = AWSXRay.captureAWSv3Client(new DynamoDBClient({}));
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.TABLE_NAME || 'BankAccounts';

interface BankAccount {
  accountId: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'INVESTMENT';
  currency: 'GBP' | 'EUR';
  balance?: number;
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
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: ''
        };

      case 'POST':
        if (path === '/accounts') {
          return await createAccount(event);
        }
        break;

      case 'GET':
        if (path === '/accounts') {
          return await getAccounts(event);
        } else if (path.startsWith('/accounts/')) {
          return await getAccount(event);
        }
        break;

      case 'PUT':
        if (path.startsWith('/accounts/')) {
          return await updateAccount(event);
        }
        break;

      case 'DELETE':
        if (path.startsWith('/accounts/')) {
          return await deleteAccount(event);
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

async function createAccount(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  const account: Omit<BankAccount, 'accountId' | 'createdAt' | 'updatedAt'> = JSON.parse(event.body);

  // Validate required fields
  if (!account.accountName || !account.accountNumber || !account.bankName ||
      !account.accountType || !account.currency) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing required fields: accountName, accountNumber, bankName, accountType, currency' })
    };
  }

  // Validate account type
  if (!['CHECKING', 'SAVINGS', 'CREDIT', 'INVESTMENT'].includes(account.accountType)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Account type must be CHECKING, SAVINGS, CREDIT, or INVESTMENT' })
    };
  }

  // Validate currency
  if (!['GBP', 'EUR'].includes(account.currency)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Currency must be GBP or EUR' })
    };
  }

  const accountId = uuidv4();
  const now = new Date().toISOString();

  const newAccount: BankAccount = {
    ...account,
    accountId,
    isActive: account.isActive !== undefined ? account.isActive : true,
    createdAt: now,
    updatedAt: now
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: newAccount
  }));

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify(newAccount)
  };
}

async function getAccounts(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const queryParams = event.queryStringParameters || {};
  const isActive = queryParams.isActive;

  let filterExpression: string | undefined;
  let expressionAttributeValues: Record<string, any> | undefined;

  if (isActive !== undefined) {
    filterExpression = 'isActive = :isActive';
    expressionAttributeValues = {
      ':isActive': isActive === 'true'
    };
  }

  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: filterExpression,
    ExpressionAttributeValues: expressionAttributeValues
  });

  const result = await docClient.send(command);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      accounts: result.Items || [],
      count: result.Count || 0
    })
  };
}

async function getAccount(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParams = event.pathParameters;

  if (!pathParams?.accountId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'accountId parameter is required' })
    };
  }

  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      accountId: pathParams.accountId
    }
  }));

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Account not found' })
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.Item)
  };
}

async function updateAccount(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParams = event.pathParameters;

  if (!pathParams?.accountId || !event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'accountId and request body are required' })
    };
  }

  const updates = JSON.parse(event.body);

  // Don't allow updating accountId, createdAt
  delete updates.accountId;
  delete updates.createdAt;

  // Add updatedAt timestamp
  updates.updatedAt = new Date().toISOString();

  // Validate account type if provided
  if (updates.accountType && !['CHECKING', 'SAVINGS', 'CREDIT', 'INVESTMENT'].includes(updates.accountType)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Account type must be CHECKING, SAVINGS, CREDIT, or INVESTMENT' })
    };
  }

  // Validate currency if provided
  if (updates.currency && !['GBP', 'EUR'].includes(updates.currency)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Currency must be GBP or EUR' })
    };
  }

  // Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  Object.keys(updates).forEach((key, index) => {
    const attributeName = `#attr${index}`;
    const attributeValue = `:val${index}`;

    updateExpressions.push(`${attributeName} = ${attributeValue}`);
    expressionAttributeNames[attributeName] = key;
    expressionAttributeValues[attributeValue] = updates[key];
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
      accountId: pathParams.accountId
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

async function deleteAccount(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParams = event.pathParameters;

  if (!pathParams?.accountId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'accountId parameter is required' })
    };
  }

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      accountId: pathParams.accountId
    }
  }));

  return {
    statusCode: 204,
    headers: corsHeaders,
    body: ''
  };
}