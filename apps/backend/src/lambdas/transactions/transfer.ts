import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { created, badRequest, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { CreateTransferSchema } from './schema';

const TABLE_NAME = process.env['TRANSACTIONS_TABLE'] ?? 'BankTransactions';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const raw = parseBody(event.body);
    if (raw === null) return badRequest('Invalid JSON');
    const parsed = validate(CreateTransferSchema, raw);
    if (!parsed.success) return parsed.response;
    const { fromAccount, toAccount, date, description, currency, amount, fee } = parsed.data;
    const now = new Date().toISOString();
    const debit = {
      account: fromAccount,
      transactionId: uuidv4(),
      type: 'transfer' as const,
      date,
      description,
      currency,
      amount: -amount,
      fee,
      toAccount,
      createdAt: now,
      updatedAt: now,
    };
    const credit = {
      account: toAccount,
      transactionId: uuidv4(),
      type: 'transfer' as const,
      date,
      description,
      currency,
      amount,
      fee: 0,
      toAccount: fromAccount,
      createdAt: now,
      updatedAt: now,
    };
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: TABLE_NAME, Item: debit } },
        { Put: { TableName: TABLE_NAME, Item: credit } },
      ],
    }));
    return created({ debit, credit });
  } catch (error) {
    log.error('createTransfer error', { error });
    return internalError();
  }
};
