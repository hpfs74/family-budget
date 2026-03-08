import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient, buildUpdateExpression } from '../../shared/db';
import { ok, badRequest, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { UpdateCategorySchema } from './schema';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'Categories';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { categoryId } = event.pathParameters ?? {};
    if (!categoryId) return badRequest('categoryId is required');
    const raw = parseBody(event.body);
    if (raw === null) return badRequest('Invalid JSON');
    const parsed = validate(UpdateCategorySchema, raw);
    if (!parsed.success) return parsed.response;
    const rawKeys = raw !== null && typeof raw === 'object' ? Object.keys(raw as object) : [];
    if (rawKeys.length === 0) return badRequest('No valid fields to update');
    const updates = { ...parsed.data, updatedAt: new Date().toISOString() };
    const expr = buildUpdateExpression(updates, ['categoryId', 'createdAt']);
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { categoryId },
      ...expr,
      ReturnValues: 'ALL_NEW',
    }));
    return ok(result.Attributes);
  } catch (error) {
    log.error('updateCategory error', { error });
    return internalError();
  }
};
