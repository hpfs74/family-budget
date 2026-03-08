import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { noContent, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'Categories';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { categoryId } = event.pathParameters ?? {};
    if (!categoryId) return badRequest('categoryId is required');
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { categoryId } }));
    return noContent();
  } catch (error) {
    log.error('deleteCategory error', { error });
    return internalError();
  }
};
