import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import log from 'lambda-log';
import { docClient } from '../../shared/db';
import { ok, internalError } from '../../shared/response';

const TABLE_NAME = process.env['TABLE_NAME'] ?? 'Categories';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const isActive = event.queryStringParameters?.['isActive'];
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      ...(isActive !== undefined && {
        FilterExpression: 'isActive = :isActive',
        ExpressionAttributeValues: { ':isActive': isActive === 'true' },
      }),
    }));
    return ok({ categories: result.Items ?? [], count: result.Count ?? 0 });
  } catch (error) {
    log.error('listCategories error', { error });
    return internalError();
  }
};
