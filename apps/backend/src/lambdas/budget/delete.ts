import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { noContent, badRequest, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BudgetPlanner';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { budgetId } = event.pathParameters ?? {};
    if (!budgetId) return badRequest('budgetId is required');
    await docClient.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { budgetId } }));
    return noContent();
  } catch (error) {
    log.error('deleteBudget error', { error });
    return internalError();
  }
};
