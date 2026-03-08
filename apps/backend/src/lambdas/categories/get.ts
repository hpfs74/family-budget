import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, notFound, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'Categories';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { categoryId } = event.pathParameters ?? {};
    if (!categoryId) return badRequest('categoryId is required');
    const result = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { categoryId } }));
    if (!result.Item) return notFound('Category not found');
    return ok(result.Item);
  } catch (error) {
    log.error('getCategory error', { error });
    return internalError();
  }
};
