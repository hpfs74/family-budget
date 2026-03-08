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

const TABLE_NAME = process.env.TABLE_NAME || 'Categories';

interface Category {
  categoryId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
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
        if (path === '/categories') {
          return await createCategory(event);
        }
        break;

      case 'GET':
        if (path === '/categories') {
          return await getCategories(event);
        } else if (path.startsWith('/categories/')) {
          return await getCategory(event);
        }
        break;

      case 'PUT':
        if (path.startsWith('/categories/')) {
          return await updateCategory(event);
        }
        break;

      case 'DELETE':
        if (path.startsWith('/categories/')) {
          return await deleteCategory(event);
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
    log.error('Categories handler error:', {
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

async function createCategory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Request body is required' })
    };
  }

  const category: Omit<Category, 'categoryId' | 'createdAt' | 'updatedAt'> = JSON.parse(event.body);

  // Validate required fields
  if (!category.name) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing required field: name' })
    };
  }

  const categoryId = uuidv4();
  const now = new Date().toISOString();

  const newCategory: Category = {
    ...category,
    categoryId,
    isActive: category.isActive !== undefined ? category.isActive : true,
    createdAt: now,
    updatedAt: now
  };

  await docClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: newCategory
  }));

  return {
    statusCode: 201,
    headers: corsHeaders,
    body: JSON.stringify(newCategory)
  };
}

async function getCategories(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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
      categories: result.Items || [],
      count: result.Count || 0
    })
  };
}

async function getCategory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParams = event.pathParameters;

  if (!pathParams?.categoryId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'categoryId parameter is required' })
    };
  }

  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: {
      categoryId: pathParams.categoryId
    }
  }));

  if (!result.Item) {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Category not found' })
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.Item)
  };
}

async function updateCategory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParams = event.pathParameters;

  if (!pathParams?.categoryId || !event.body) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'categoryId and request body are required' })
    };
  }

  const updates = JSON.parse(event.body);

  // Don't allow updating categoryId, createdAt
  delete updates.categoryId;
  delete updates.createdAt;

  // Add updatedAt timestamp
  updates.updatedAt = new Date().toISOString();

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
      categoryId: pathParams.categoryId
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

async function deleteCategory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const pathParams = event.pathParameters;

  if (!pathParams?.categoryId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'categoryId parameter is required' })
    };
  }

  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      categoryId: pathParams.categoryId
    }
  }));

  return {
    statusCode: 204,
    headers: corsHeaders,
    body: ''
  };
}