import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BudgetPlanner';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const year = event.queryStringParameters?.['year']
      ? parseInt(event.queryStringParameters['year'])
      : new Date().getFullYear();
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: '#yr = :year',
      ExpressionAttributeNames: { '#yr': 'year' },
      ExpressionAttributeValues: { ':year': year },
    }));
    return ok({ items: result.Items ?? [], count: result.Count ?? 0 });
  } catch (error) {
    log.error('listBudget error', { error });
    return internalError();
  }
};
