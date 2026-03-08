import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, notFound, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BudgetPlanner';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { budgetId } = event.pathParameters ?? {};
    if (!budgetId) return badRequest('budgetId is required');
    const result = await docClient.send(new GetCommand({ TableName: TABLE_NAME, Key: { budgetId } }));
    if (!result.Item) return notFound('Budget item not found');
    return ok(result.Item);
  } catch (error) {
    log.error('getBudget error', { error });
    return internalError();
  }
};
