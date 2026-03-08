import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient, buildUpdateExpression } from '../../shared/db';
import { ok, badRequest, internalError } from '../../shared/response';
import { validate, parseBody } from '../../shared/validation';
import { UpdateBudgetSchema } from './schema';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'BudgetPlanner';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { budgetId } = event.pathParameters ?? {};
    if (!budgetId) return badRequest('budgetId is required');
    const raw = parseBody(event.body);
    if (raw === null) return badRequest('Invalid JSON');
    if (typeof raw === 'object' && Object.keys(raw as object).length === 0) return badRequest('No valid fields to update');
    const parsed = validate(UpdateBudgetSchema, raw);
    if (!parsed.success) return parsed.response;
    const updates = { ...parsed.data, updatedAt: new Date().toISOString() };
    const expr = buildUpdateExpression(updates, ['budgetId', 'createdAt']);
    const result = await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { budgetId },
      ...expr,
      ReturnValues: 'ALL_NEW',
    }));
    return ok(result.Attributes);
  } catch (error) {
    log.error('updateBudget error', { error });
    return internalError();
  }
};
