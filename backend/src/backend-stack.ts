import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
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

    // DynamoDB table for bank transactions
    const transactionsTable = new dynamodb.Table(this, 'TransactionsTable', {
      tableName: 'BankTransactions',
      partitionKey: {
        name: 'account',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'transactionId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Global Secondary Index for querying by date
    transactionsTable.addGlobalSecondaryIndex({
      indexName: 'DateIndex',
      partitionKey: {
        name: 'account',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'date',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // Global Secondary Index for querying by category
    transactionsTable.addGlobalSecondaryIndex({
      indexName: 'CategoryIndex',
      partitionKey: {
        name: 'account',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'category',
        type: dynamodb.AttributeType.STRING,
      },
    });

    // DynamoDB table for bank accounts
    const accountsTable = new dynamodb.Table(this, 'AccountsTable', {
      tableName: 'BankAccounts',
      partitionKey: {
        name: 'accountId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Lambda function for transactions CRUD operations
    const transactionsLambda = new lambda.Function(this, 'TransactionsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'transactions-handler.handler',
      code: lambda.Code.fromAsset('backend/src'),
      environment: {
        TABLE_NAME: transactionsTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Grant DynamoDB permissions to Lambda
    transactionsTable.grantReadWriteData(transactionsLambda);

    // Lambda function for accounts CRUD operations
    const accountsLambda = new lambda.Function(this, 'AccountsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'accounts-handler.handler',
      code: lambda.Code.fromAsset('backend/src'),
      environment: {
        TABLE_NAME: accountsTable.tableName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Grant DynamoDB permissions to accounts Lambda
    accountsTable.grantReadWriteData(accountsLambda);

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

    // Transactions API endpoints
    const transactionsIntegration = new apigateway.LambdaIntegration(transactionsLambda);
    const transactionsResource = api.root.addResource('transactions');

    // /transactions - GET (list), POST (create)
    transactionsResource.addMethod('GET', transactionsIntegration);
    transactionsResource.addMethod('POST', transactionsIntegration);

    // /transactions/{transactionId} - GET (read), PUT (update), DELETE
    const transactionResource = transactionsResource.addResource('{transactionId}');
    transactionResource.addMethod('GET', transactionsIntegration);
    transactionResource.addMethod('PUT', transactionsIntegration);
    transactionResource.addMethod('DELETE', transactionsIntegration);

    // Accounts API endpoints
    const accountsIntegration = new apigateway.LambdaIntegration(accountsLambda);
    const accountsResource = api.root.addResource('accounts');

    // /accounts - GET (list), POST (create)
    accountsResource.addMethod('GET', accountsIntegration);
    accountsResource.addMethod('POST', accountsIntegration);

    // /accounts/{accountId} - GET (read), PUT (update), DELETE
    const accountResource = accountsResource.addResource('{accountId}');
    accountResource.addMethod('GET', accountsIntegration);
    accountResource.addMethod('PUT', accountsIntegration);
    accountResource.addMethod('DELETE', accountsIntegration);

    // Output the API endpoint
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

    // Output the DynamoDB table names
    new cdk.CfnOutput(this, 'TransactionsTableName', {
      value: transactionsTable.tableName,
      description: 'DynamoDB table name for bank transactions',
    });

    new cdk.CfnOutput(this, 'AccountsTableName', {
      value: accountsTable.tableName,
      description: 'DynamoDB table name for bank accounts',
    });
  }
}