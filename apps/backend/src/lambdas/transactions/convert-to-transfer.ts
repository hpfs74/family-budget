import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient, buildUpdateExpression } from '../../shared/db';
import { ok, notFound, badRequest, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { ConvertToTransferSchema } from './schema';

const TABLE_NAME = process.env['TRANSACTIONS_TABLE'] ?? 'BankTransactions';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { transactionId } = event.pathParameters ?? {};
    if (!transactionId) return badRequest('transactionId is required');
    const raw = parseBody(event.body);
    if (raw === null) return badRequest('Invalid JSON');
    const parsed = validate(ConvertToTransferSchema, raw);
    if (!parsed.success) return parsed.response;
    const { account, toAccount } = parsed.data;
    const getResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { account, transactionId },
    }));
    if (!getResult.Item) return notFound('Transaction not found');
    const now = new Date().toISOString();
    const updates = { type: 'transfer', toAccount, updatedAt: now };
    const expr = buildUpdateExpression(updates, ['account', 'transactionId']);
    const updateResult = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { account, transactionId },
      ...expr,
      ReturnValues: 'ALL_NEW',
    }));
    return ok(updateResult.Attributes);
  } catch (error) {
    log.error('convertToTransfer error', { error });
    return internalError();
  }
};
