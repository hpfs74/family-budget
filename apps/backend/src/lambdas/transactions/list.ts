import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TRANSACTIONS_TABLE'] ?? 'BankTransactions';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { account, category, startDate, endDate } = event.queryStringParameters ?? {};
    if (!account) return badRequest('account is required');

    let filterExpression: string | undefined;
    let filterAttributeNames: Record<string, string> | undefined;
    let filterAttributeValues: Record<string, unknown> | undefined;

    if (startDate && endDate) {
      filterExpression = '#date BETWEEN :startDate AND :endDate';
      filterAttributeNames = { '#date': 'date' };
      filterAttributeValues = { ':startDate': startDate, ':endDate': endDate };
    }

    let command: QueryCommand;
    if (category) {
      command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: 'CategoryIndex',
        KeyConditionExpression: 'account = :account AND category = :category',
        ExpressionAttributeValues: {
          ':account': account,
          ':category': category,
          ...(filterAttributeValues ?? {}),
        },
        ...(filterExpression ? { FilterExpression: filterExpression } : {}),
        ...(filterAttributeNames ? { ExpressionAttributeNames: filterAttributeNames } : {}),
      });
    } else {
      command = new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'account = :account',
        ExpressionAttributeValues: {
          ':account': account,
          ...(filterAttributeValues ?? {}),
        },
        ...(filterExpression ? { FilterExpression: filterExpression } : {}),
        ...(filterAttributeNames ? { ExpressionAttributeNames: filterAttributeNames } : {}),
      });
    }

    const result = await docClient.send(command);
    return ok({ transactions: result.Items ?? [] });
  } catch (error) {
    log.error('listTransactions error', { error });
    return internalError();
  }
};
