import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { noContent, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BankAccounts';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { accountId } = event.pathParameters ?? {};
    if (!accountId) return badRequest('accountId is required');
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { accountId } }));
    return noContent();
  } catch (error) {
    log.error('deleteAccount error', { error });
    return internalError();
  }
};
