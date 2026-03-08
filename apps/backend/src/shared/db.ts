import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import AWSXRay from 'aws-xray-sdk-core';

const rawClient = new DynamoDBClient({});
// X-Ray is only active in the Lambda runtime (AWS_EXECUTION_ENV is set there)
const tracedClient = process.env['AWS_EXECUTION_ENV']
  ? AWSXRay.captureAWSv3Client(rawClient)
  : rawClient;

export const docClient = DynamoDBDocumentClient.from(tracedClient);

/**
 * Build a DynamoDB SET update expression from a plain object.
 * Omits keys listed in `omitKeys` (e.g. primary key fields that must not be updated).
 */
export const buildUpdateExpression = (
  updates: Record<string, unknown>,
  omitKeys: string[] = [],
): {
  UpdateExpression: string;
  ExpressionAttributeNames: Record<string, string>;
  ExpressionAttributeValues: Record<string, unknown>;
} => {
  const entries = Object.entries(updates).filter(
    ([k, v]) => !omitKeys.includes(k) && v !== undefined,
  );
  return {
    UpdateExpression: `SET ${entries.map((_, i) => `#attr${i} = :val${i}`).join(', ')}`,
    ExpressionAttributeNames: Object.fromEntries(entries.map(([k], i) => [`#attr${i}`, k])),
    ExpressionAttributeValues: Object.fromEntries(entries.map(([, v], i) => [`:val${i}`, v])),
  };
};
