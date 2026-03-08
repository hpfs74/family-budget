import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient, buildUpdateExpression } from '../../shared/db';
import { ok, badRequest, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { UpdateTransactionSchema } from './schema';

const TABLE_NAME = process.env['TRANSACTIONS_TABLE'] ?? 'BankTransactions';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { transactionId } = event.pathParameters ?? {};
    if (!transactionId) return badRequest('transactionId is required');
    const raw = parseBody(event.body);
    if (raw === null) return badRequest('Invalid JSON');
    const parsed = validate(UpdateTransactionSchema, raw);
    if (!parsed.success) return parsed.response;
    const rawKeys = raw !== null && typeof raw === 'object'
      ? Object.keys(raw as object).filter(k => k !== 'account' && k !== 'transactionId')
      : [];
    if (rawKeys.length === 0) return badRequest('No valid fields to update');
    const account = (raw as Record<string, unknown>)['account'] as string | undefined;
    if (!account) return badRequest('account is required in body');
    const updates = { ...parsed.data, updatedAt: new Date().toISOString() };
    const expr = buildUpdateExpression(updates, ['account', 'transactionId']);
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { account, transactionId },
      ...expr,
      ReturnValues: 'ALL_NEW',
    }));
    return ok(result.Attributes);
  } catch (error) {
    log.error('updateTransaction error', { error });
    return internalError();
  }
};
