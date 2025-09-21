import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
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
  transferId?: string;
  transferType?: 'outgoing' | 'incoming' | 'regular';
  relatedAccount?: string;
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
        } else if (path === '/transactions/transfer') {
          return await createTransfer(event);
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
        if (path.startsWith('/transactions/') && path.endsWith('/convert-to-transfer')) {
          return await convertTransactionToTransfer(event);
        } else if (path.startsWith('/transactions/')) {
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
    log.error('Handler error:', { error: error instanceof Error ? error.message : error, stack: error instanceof Error ? error.stack : undefined });
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

  const result = await docClient.send(command) as any;

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
  const queryParams = event.queryStringParameters || {};

  if (!pathParams?.transactionId || !queryParams.account || !event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'transactionId, account, and request body are required' })
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
      account: queryParams.account,
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

async function createTransfer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  const transferData = JSON.parse(event.body);

  // Validate required fields for transfer
  if (!transferData.fromAccount || !transferData.toAccount ||
      !transferData.amount || !transferData.date || !transferData.description) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing required fields: fromAccount, toAccount, amount, date, description' })
    };
  }

  if (transferData.fromAccount === transferData.toAccount) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Cannot transfer to the same account' })
    };
  }

  // Validate currency
  if (!['GBP', 'EUR'].includes(transferData.currency)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Currency must be GBP or EUR' })
    };
  }

  const transferId = uuidv4();
  const outgoingTransactionId = uuidv4();
  const incomingTransactionId = uuidv4();

  // Create outgoing transaction (negative amount)
  const outgoingTransaction: Transaction = {
    account: transferData.fromAccount,
    transactionId: outgoingTransactionId,
    date: transferData.date,
    description: transferData.description,
    currency: transferData.currency,
    amount: -Math.abs(transferData.amount), // Ensure negative
    fee: transferData.fee || 0,
    category: 'transfer',
    transferId,
    transferType: 'outgoing',
    relatedAccount: transferData.toAccount
  };

  // Create incoming transaction (positive amount)
  const incomingTransaction: Transaction = {
    account: transferData.toAccount,
    transactionId: incomingTransactionId,
    date: transferData.date,
    description: transferData.description,
    currency: transferData.currency,
    amount: Math.abs(transferData.amount), // Ensure positive
    fee: 0, // Fees typically only apply to the outgoing transaction
    category: 'transfer',
    transferId,
    transferType: 'incoming',
    relatedAccount: transferData.fromAccount
  };

  try {
    // Create both transactions
    await Promise.all([
      docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: outgoingTransaction
      })),
      docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: incomingTransaction
      }))
    ]);

    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        transferId,
        outgoingTransaction,
        incomingTransaction
      })
    };
  } catch (error) {
    log.error('Error creating transfer:', { error: error instanceof Error ? error.message : error, stack: error instanceof Error ? error.stack : undefined });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to create transfer' })
    };
  }
}

async function convertTransactionToTransfer(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParams = event.pathParameters;
  const queryParams = event.queryStringParameters || {};

  log.debug('Convert to transfer request:', {
    pathParams,
    queryParams,
    hasBody: !!event.body
  });

  if (!pathParams?.transactionId || !queryParams.account || !event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'transactionId, account, and request body are required',
        debug: {
          transactionId: pathParams?.transactionId,
          account: queryParams.account,
          hasBody: !!event.body
        }
      })
    };
  }

  let toAccount = '';
  try {
    const requestData = JSON.parse(event.body);
    toAccount = requestData.toAccount;
  } catch (err: unknown) {
    const error = err as Error;

    log.error('Invalid JSON in request body:', {
      reason: error.message,
      stack: error.stack
    });

    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid JSON in request body' })
    };
  }
  

  if (!toAccount) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'toAccount is required' })
    };
  }

  if (queryParams.account === toAccount) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Cannot transfer to the same account' })
    };
  }

  try {
    // Ensure the key values are strings and not undefined
    const accountKey = String(queryParams.account);
    const transactionIdKey = String(pathParams.transactionId);

    // Get the original transaction
    const getKey = {
      account: accountKey,
      transactionId: transactionIdKey
    };
    log.debug('Getting transaction:', {
      key: getKey,
      keyTypes: {
        account: typeof accountKey,
        transactionId: typeof transactionIdKey
      }
    });

    const getResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: getKey
    }));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Transaction not found' })
      };
    }

    const originalTransaction = getResult.Item as Transaction;

    // Check if it's already a transfer
    if (originalTransaction.transferType) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Transaction is already a transfer' })
      };
    }

    const transferId = uuidv4();
    const incomingTransactionId = uuidv4();

    // Update the original transaction to be an outgoing transfer
    const updateResult = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        account: accountKey,
        transactionId: transactionIdKey
      },
      UpdateExpression: 'SET #transferId = :transferId, #transferType = :transferType, #relatedAccount = :relatedAccount, #category = :category, #amount = :amount',
      ExpressionAttributeNames: {
        '#transferId': 'transferId',
        '#transferType': 'transferType',
        '#relatedAccount': 'relatedAccount',
        '#category': 'category',
        '#amount': 'amount'
      },
      ExpressionAttributeValues: {
        ':transferId': transferId,
        ':transferType': 'outgoing',
        ':relatedAccount': toAccount,
        ':category': 'transfer',
        ':amount': -Math.abs(originalTransaction.amount) // Ensure negative for outgoing
      },
      ReturnValues: 'ALL_NEW'
    }));

    // Create the corresponding incoming transaction
    const incomingTransaction: Transaction = {
      account: toAccount,
      transactionId: incomingTransactionId,
      date: originalTransaction.date,
      description: originalTransaction.description,
      currency: originalTransaction.currency,
      amount: Math.abs(originalTransaction.amount), // Ensure positive for incoming
      fee: 0, // Fees only apply to outgoing transaction
      category: 'transfer',
      transferId,
      transferType: 'incoming',
      relatedAccount: queryParams.account
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: incomingTransaction
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        outgoingTransaction: updateResult.Attributes,
        incomingTransaction,
        transferId
      })
    };
  } catch (error) {
    log.error('Error converting transaction to transfer:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to convert transaction to transfer' })
    };
  }
}