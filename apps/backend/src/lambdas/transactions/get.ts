import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, notFound, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TRANSACTIONS_TABLE'] ?? 'BankTransactions';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { transactionId } = event.pathParameters ?? {};
    const { account } = event.queryStringParameters ?? {};
    if (!transactionId) return badRequest('transactionId is required');
    if (!account) return badRequest('account is required');
    const result = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { account, transactionId },
    }));
    if (!result.Item) return notFound('Transaction not found');
    return ok(result.Item);
  } catch (error) {
    log.error('getTransaction error', { error });
    return internalError();
  }
};
