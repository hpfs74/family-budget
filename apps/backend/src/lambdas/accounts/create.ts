import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { created, badRequest, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { CreateAccountSchema } from './schema';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BankAccounts';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const raw = parseBody(event.body);
    if (raw === null) return badRequest('Invalid JSON');
    const parsed = validate(CreateAccountSchema, raw);
    if (!parsed.success) return parsed.response;
    const now = new Date().toISOString();
    const account = { accountId: uuidv4(), ...parsed.data, createdAt: now, updatedAt: now };
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: account }));
    return created(account);
  } catch (error) {
    log.error('createAccount error', { error });
    return internalError();
  }
};
