import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient, buildUpdateExpression } from '../../shared/db';
import { ok, badRequest, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { UpdateAccountSchema } from './schema';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BankAccounts';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { accountId } = event.pathParameters ?? {};
    if (!accountId) return badRequest('accountId is required');
    const raw = parseBody(event.body);
    if (raw === null) return badRequest('Invalid JSON');
    const parsed = validate(UpdateAccountSchema, raw);
    if (!parsed.success) return parsed.response;
    const rawKeys = raw !== null && typeof raw === 'object' ? Object.keys(raw as object) : [];
    if (rawKeys.length === 0) return badRequest('No valid fields to update');
    const updates = { ...parsed.data, updatedAt: new Date().toISOString() };
    const expr = buildUpdateExpression(updates, ['accountId', 'createdAt']);
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { accountId },
      ...expr,
      ReturnValues: 'ALL_NEW',
    }));
    return ok(result.Attributes);
  } catch (error) {
    log.error('updateAccount error', { error });
    return internalError();
  }
};
