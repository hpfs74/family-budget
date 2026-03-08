import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { created, badRequest, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { CreateCategorySchema } from './schema';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'Categories';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const raw = parseBody(event.body);
    if (raw === null) return badRequest('Invalid JSON');
    const parsed = validate(CreateCategorySchema, raw);
    if (!parsed.success) return parsed.response;
    const now = new Date().toISOString();
    const category = { categoryId: uuidv4(), ...parsed.data, createdAt: now, updatedAt: now };
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: category }));
    return created(category);
  } catch (error) {
    log.error('createCategory error', { error });
    return internalError();
  }
};
