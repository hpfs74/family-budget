import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient, buildUpdateExpression } from '../../shared/db';
import { ok, badRequest, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { BulkUpdateSchema } from './schema';

const TABLE_NAME = process.env['TRANSACTIONS_TABLE'] ?? 'BankTransactions';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const raw = parseBody(event.body);
    if (raw === null) return badRequest('Invalid JSON');
    const parsed = validate(BulkUpdateSchema, raw);
    if (!parsed.success) return parsed.response;
    const { account, transactionIds, updates } = parsed.data;
    const updatedAt = new Date().toISOString();
    const updatesWithTimestamp = { ...updates, updatedAt };
    const expr = buildUpdateExpression(updatesWithTimestamp, ['account', 'transactionId']);
    for (const transactionId of transactionIds) {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { account, transactionId },
        ...expr,
      }));
    }
    return ok({ updated: transactionIds.length });
  } catch (error) {
    log.error('bulkUpdateTransactions error', { error });
    return internalError();
  }
};
