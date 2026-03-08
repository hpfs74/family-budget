import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { noContent, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TRANSACTIONS_TABLE'] ?? 'BankTransactions';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { transactionId } = event.pathParameters ?? {};
    const { account } = event.queryStringParameters ?? {};
    if (!transactionId) return badRequest('transactionId is required');
    if (!account) return badRequest('account is required');
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { account, transactionId },
    }));
    return noContent();
  } catch (error) {
    log.error('deleteTransaction error', { error });
    return internalError();
  }
};
