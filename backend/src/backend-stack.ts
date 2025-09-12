import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda function that returns current date and time
    const dateTimeLambda = new lambda.Function(this, 'DateTimeFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          const now = new Date();
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            body: JSON.stringify({
              dateTime: now.toISOString(),
              timestamp: now.getTime(),
              formatted: now.toLocaleString()
            })
          };
        };
      `),
    });

    // API Gateway
    const api = new apigateway.RestApi(this, 'DateTimeApi', {
      restApiName: 'Budget App DateTime Service',
      description: 'API to get current date and time',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type'],
      },
    });

    // API Gateway integration with Lambda
    const dateTimeIntegration = new apigateway.LambdaIntegration(dateTimeLambda);
    api.root.addResource('datetime').addMethod('GET', dateTimeIntegration);

    // Output the API endpoint
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });
  }
}