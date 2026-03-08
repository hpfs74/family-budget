import { APIGatewayProxyResult } from 'aws-lambda';
import { ZodSchema } from 'zod';
import { badRequest } from './response';

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; response: APIGatewayProxyResult };

export const validate = <T>(
  schema: ZodSchema<T>,
  data: unknown,
): ValidationResult<T> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map(i => `${i.path.join('.')}: ${i.message}`)
      .join(', ');
    return { success: false, response: badRequest(message) };
  }
  return { success: true, data: result.data };
};

export const parseBody = (body: string | null | undefined): unknown => {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};
