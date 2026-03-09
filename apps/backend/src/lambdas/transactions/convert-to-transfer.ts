import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import log from 'lambda-log';
import { docClient, buildUpdateExpression } from '../../shared/db';
import { ok, notFound, badRequest, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { ConvertToTransferSchema } from './schema';

const TABLE_NAME = process.env['TRANSACTIONS_TABLE'] ?? 'BankTransactions';
const MATCH_DAYS = 7; // search window ±7 days for matching transaction

/** Returns YYYY-MM-DD offset by `days` */
function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Find a matching transaction in `toAccount` with same |amount|, within ±MATCH_DAYS */
async function findMatchingTransaction(
  toAccount: string,
  amount: number,
  date: string,
): Promise<Record<string, unknown> | null> {
  const absAmount = Math.abs(amount);
  const from = offsetDate(date, -MATCH_DAYS);
  const to = offsetDate(date, MATCH_DAYS);

  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: 'account = :acc',
    FilterExpression:
      '#date BETWEEN :from AND :to AND (amount = :pos OR amount = :neg)',
    ExpressionAttributeNames: { '#date': 'date' },
    ExpressionAttributeValues: {
      ':acc': toAccount,
      ':from': from,
      ':to': to,
      ':pos': absAmount,
      ':neg': -absAmount,
    },
  }));

  const items = (result.Items ?? []) as Record<string, unknown>[];
  // Prefer unlinked transactions; pick the closest date
  const unlinked = items.filter(t => !t['transferId']);
  const pool = unlinked.length > 0 ? unlinked : items;
  if (pool.length === 0) return null;

  pool.sort((a, b) => {
    const da = Math.abs(new Date(a['date'] as string).getTime() - new Date(date).getTime());
    const db = Math.abs(new Date(b['date'] as string).getTime() - new Date(date).getTime());
    return da - db;
  });
  return pool[0];
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { transactionId } = event.pathParameters ?? {};
    if (!transactionId) return badRequest('transactionId is required');

    const raw = parseBody(event.body);
    if (raw === null) return badRequest('Invalid JSON');

    const parsed = validate(ConvertToTransferSchema, raw);
    if (!parsed.success) return parsed.response;

    const { account, toAccount, categoryId } = parsed.data;

    // Load source transaction
    const getResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { account, transactionId },
    }));
    if (!getResult.Item) return notFound('Transaction not found');
    const source = getResult.Item as Record<string, unknown>;

    const transferId = (source['transferId'] as string | undefined) ?? randomUUID();
    const now = new Date().toISOString();

    // Find matching destination transaction
    const dest = await findMatchingTransaction(
      toAccount,
      source['amount'] as number,
      source['date'] as string,
    );

    // Update source transaction → outgoing
    const sourceUpdates: Record<string, unknown> = {
      transferId,
      transferType: 'outgoing',
      relatedAccount: toAccount,
      updatedAt: now,
    };
    if (categoryId) sourceUpdates['category'] = categoryId;
    if (dest) sourceUpdates['relatedTransactionId'] = dest['transactionId'];

    const srcExpr = buildUpdateExpression(sourceUpdates, ['account', 'transactionId']);
    const srcResult = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { account, transactionId },
      ...srcExpr,
      ReturnValues: 'ALL_NEW',
    }));

    // Update destination transaction → incoming (if found)
    let destResult: Record<string, unknown> | null = null;
    if (dest) {
      const destUpdates: Record<string, unknown> = {
        transferId,
        transferType: 'incoming',
        relatedAccount: account,
        relatedTransactionId: transactionId,
        updatedAt: now,
      };
      if (categoryId) destUpdates['category'] = categoryId;

      const destExpr = buildUpdateExpression(destUpdates, ['account', 'transactionId']);
      const destUpdateResult = await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { account: toAccount, transactionId: dest['transactionId'] as string },
        ...destExpr,
        ReturnValues: 'ALL_NEW',
      }));
      destResult = destUpdateResult.Attributes as Record<string, unknown>;
    }

    return ok({
      source: srcResult.Attributes,
      destination: destResult,
      matched: !!destResult,
    });
  } catch (error) {
    log.error('convertToTransfer error', { error });
    return internalError();
  }
};
