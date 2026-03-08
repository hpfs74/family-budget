import { APIGatewayProxyResult } from 'aws-lambda';

export const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export const ok = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 200,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

export const created = (body: unknown): APIGatewayProxyResult => ({
  statusCode: 201,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

export const noContent = (): APIGatewayProxyResult => ({
  statusCode: 204,
  headers: corsHeaders,
  body: '',
});

export const badRequest = (message: string): APIGatewayProxyResult => ({
  statusCode: 400,
  headers: corsHeaders,
  body: JSON.stringify({ error: message }),
});

export const notFound = (message: string): APIGatewayProxyResult => ({
  statusCode: 404,
  headers: corsHeaders,
  body: JSON.stringify({ error: message }),
});

export const internalError = (): APIGatewayProxyResult => ({
  statusCode: 500,
  headers: corsHeaders,
  body: JSON.stringify({ error: 'Internal server error' }),
});
