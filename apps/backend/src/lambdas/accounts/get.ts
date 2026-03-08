import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, notFound, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BankAccounts';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { accountId } = event.pathParameters ?? {};
    if (!accountId) return badRequest('accountId is required');
    const result = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { accountId } }));
    if (!result.Item) return notFound('Account not found');
    return ok(result.Item);
  } catch (error) {
    log.error('getAccount error', { error });
    return internalError();
  }
};
