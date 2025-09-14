import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

const defaultFunctionProps = (name: string): lambda.FunctionProps => {  

  return {

    handler: `handler`,
    entry: `backend/src/assets/lambdas/${name}.ts`,
    bundling: {
      minify: true,
      loader: {'.node': 'file'},
      sourceMap: true,
    },

    // code: lambda.Code.fromAsset('backend', {
    //   bundling: {
    //     image: lambda.Runtime.NODEJS_18_X.bundlingImage,
    //     command: [
    //       'bash', '-c', [
    //         'npm install',
    //         'npx tsc src/accounts-handler.ts src/transactions-handler.ts --outDir /asset-output --target ES2020 --module CommonJS --esModuleInterop --skipLibCheck',
    //         'cp -r node_modules /asset-output/'
    //       ].join(' && ')
    //     ],
    //     user: 'root',
    //   },
    // }),

    timeout: cdk.Duration.seconds(30),
  };
};

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda function that returns current date and time
    // const dateTimeLambda = new lambda.Function(this, 'DateTimeFunction', {
      
    //   handler: 'index.handler',
    //   code: lambda.Code.fromInline(`
    //     exports.handler = async (event) => {
    //       const now = new Date();
    //       return {
    //         statusCode: 200,
    //         headers: {
    //           'Content-Type': 'application/json',
    //           'Access-Control-Allow-Origin': '*',
    //           'Access-Control-Allow-Headers': 'Content-Type',
    //           'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    //         },
    //         body: JSON.stringify({
    //           dateTime: now.toISOString(),
    //           timestamp: now.getTime(),
    //           formatted: now.toLocaleString()
    //         })
    //       };
    //     };
    //   `),
    // });

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

    // DynamoDB table for categories
    const categoriesTable = new dynamodb.Table(this, 'CategoriesTable', {
      tableName: 'Categories',
      partitionKey: {
        name: 'categoryId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // Lambda function for transactions CRUD operations
    const transactionsLambda = new lambda.NodejsFunction(
      this,
      'TransactionsFunction',
      {
        ...defaultFunctionProps('transactions-handler'),
        environment: {
          TABLE_NAME: transactionsTable.tableName,
        },
      }
    );

    // Grant DynamoDB permissions to Lambda
    transactionsTable.grantReadWriteData(transactionsLambda);

    // Lambda function for accounts CRUD operations
    const accountsLambda = new lambda.NodejsFunction(this, 'AccountsFunction', {
      ...defaultFunctionProps('accounts-handler'),      
      environment: {
        TABLE_NAME: accountsTable.tableName,
      },
    });

    // Grant DynamoDB permissions to accounts Lambda
    accountsTable.grantReadWriteData(accountsLambda);

    // Lambda function for categories CRUD operations
    const categoriesLambda = new lambda.NodejsFunction(this, 'CategoriesFunction', {
      ...defaultFunctionProps('categories-handler'),
      environment: {
        TABLE_NAME: categoriesTable.tableName,
      },
    });

    // Grant DynamoDB permissions to categories Lambda
    categoriesTable.grantReadWriteData(categoriesLambda);

    // Lambda function for analytics
    const analyticsLambda = new lambda.NodejsFunction(this, 'AnalyticsFunction', {
      ...defaultFunctionProps('analytics-handler'),
      environment: {
        TABLE_NAME: transactionsTable.tableName,
      },
    });

    // Grant DynamoDB read permissions to analytics Lambda
    transactionsTable.grantReadData(analyticsLambda);

    // API Gateway
    const api = new apigateway.RestApi(this, 'DateTimeApi', {
      restApiName: 'Budget App Service',
      description: 'API to get current date and time',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type'],
      },
    });

    // API Gateway integration with Lambda
    // const dateTimeIntegration = new apigateway.LambdaIntegration(
    //   dateTimeLambda
    // );
    // api.root.addResource('datetime').addMethod('GET', dateTimeIntegration);

    // Transactions API endpoints
    const transactionsIntegration = new apigateway.LambdaIntegration(
      transactionsLambda
    );
    const transactionsResource = api.root.addResource('transactions');

    // /transactions - GET (list), POST (create)
    transactionsResource.addMethod('GET', transactionsIntegration);
    transactionsResource.addMethod('POST', transactionsIntegration);

    // /transactions/{transactionId} - GET (read), PUT (update), DELETE
    const transactionResource =
      transactionsResource.addResource('{transactionId}');
    transactionResource.addMethod('GET', transactionsIntegration);
    transactionResource.addMethod('PUT', transactionsIntegration);
    transactionResource.addMethod('DELETE', transactionsIntegration);

    // /transactions/bulkUpdate - POST (bulk update categories)
    const bulkUpdateResource = transactionsResource.addResource('bulkUpdate');
    bulkUpdateResource.addMethod('POST', transactionsIntegration);

    // Accounts API endpoints
    const accountsIntegration = new apigateway.LambdaIntegration(
      accountsLambda
    );
    const accountsResource = api.root.addResource('accounts');

    // /accounts - GET (list), POST (create)
    accountsResource.addMethod('GET', accountsIntegration);
    accountsResource.addMethod('POST', accountsIntegration);

    // /accounts/{accountId} - GET (read), PUT (update), DELETE
    const accountResource = accountsResource.addResource('{accountId}');
    accountResource.addMethod('GET', accountsIntegration);
    accountResource.addMethod('PUT', accountsIntegration);
    accountResource.addMethod('DELETE', accountsIntegration);

    // Categories API endpoints
    const categoriesIntegration = new apigateway.LambdaIntegration(
      categoriesLambda
    );
    const categoriesResource = api.root.addResource('categories');

    // /categories - GET (list), POST (create)
    categoriesResource.addMethod('GET', categoriesIntegration);
    categoriesResource.addMethod('POST', categoriesIntegration);

    // /categories/{categoryId} - GET (read), PUT (update), DELETE
    const categoryResource = categoriesResource.addResource('{categoryId}');
    categoryResource.addMethod('GET', categoriesIntegration);
    categoryResource.addMethod('PUT', categoriesIntegration);
    categoryResource.addMethod('DELETE', categoriesIntegration);

    // Analytics API endpoints
    const analyticsIntegration = new apigateway.LambdaIntegration(
      analyticsLambda
    );
    const analyticsResource = api.root.addResource('analytics');

    // /analytics - GET (get analytics data)
    analyticsResource.addMethod('GET', analyticsIntegration);

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

    new cdk.CfnOutput(this, 'CategoriesTableName', {
      value: categoriesTable.tableName,
      description: 'DynamoDB table name for categories',
    });
  }
}
