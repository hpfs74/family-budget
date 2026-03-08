import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as awslambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import * as path from 'path';

export interface BackendStackProps extends cdk.StackProps {
  stackEnv: 'prod' | 'qa';
}

export class BackendStack extends cdk.Stack {
  readonly apiUrlOutput: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: BackendStackProps) {
    super(scope, id, props);

    const isQa = props?.stackEnv === 'qa';
    const suffix = isQa ? '-QA' : '';

    // ---------------------------------------------------------------------------
    // DynamoDB tables
    // ---------------------------------------------------------------------------

    const transactionsTable = new dynamodb.Table(this, 'TransactionsTable', {
      tableName: `BankTransactions${suffix}`,
      partitionKey: { name: 'account', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'transactionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isQa ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    transactionsTable.addGlobalSecondaryIndex({
      indexName: 'DateIndex',
      partitionKey: { name: 'account', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
    });

    transactionsTable.addGlobalSecondaryIndex({
      indexName: 'CategoryIndex',
      partitionKey: { name: 'account', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'category', type: dynamodb.AttributeType.STRING },
    });

    const accountsTable = new dynamodb.Table(this, 'AccountsTable', {
      tableName: `BankAccounts${suffix}`,
      partitionKey: { name: 'accountId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isQa ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    const categoriesTable = new dynamodb.Table(this, 'CategoriesTable', {
      tableName: `Categories${suffix}`,
      partitionKey: { name: 'categoryId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isQa ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    const budgetTable = new dynamodb.Table(this, 'BudgetTable', {
      tableName: `BudgetPlanner${suffix}`,
      partitionKey: { name: 'budgetId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: isQa ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    budgetTable.addGlobalSecondaryIndex({
      indexName: 'YearIndex',
      partitionKey: { name: 'year', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'startMonth', type: dynamodb.AttributeType.STRING },
    });

    // ---------------------------------------------------------------------------
    // Shared Lambda props
    // ---------------------------------------------------------------------------

    const commonFnProps = {
      runtime: awslambda.Runtime.NODEJS_18_X,
      bundling: { externalModules: ['aws-sdk'] },
      timeout: cdk.Duration.seconds(30),
      tracing: awslambda.Tracing.ACTIVE,
    };

    const fn = (id: string, entry: string, env: Record<string, string> = {}) =>
      new lambda.NodejsFunction(this, id, {
        ...commonFnProps,
        entry,
        environment: env,
      });

    const lambdaDir = path.join(__dirname, 'lambdas');

    // ---------------------------------------------------------------------------
    // Accounts Lambdas
    // ---------------------------------------------------------------------------

    const accountsCreate = fn(
      'AccountsCreate',
      path.join(lambdaDir, 'accounts/create.ts'),
      { TABLE_NAME: accountsTable.tableName },
    );
    const accountsList = fn(
      'AccountsList',
      path.join(lambdaDir, 'accounts/list.ts'),
      { TABLE_NAME: accountsTable.tableName },
    );
    const accountsGet = fn(
      'AccountsGet',
      path.join(lambdaDir, 'accounts/get.ts'),
      { TABLE_NAME: accountsTable.tableName },
    );
    const accountsUpdate = fn(
      'AccountsUpdate',
      path.join(lambdaDir, 'accounts/update.ts'),
      { TABLE_NAME: accountsTable.tableName },
    );
    const accountsDelete = fn(
      'AccountsDelete',
      path.join(lambdaDir, 'accounts/delete.ts'),
      { TABLE_NAME: accountsTable.tableName },
    );

    accountsTable.grantWriteData(accountsCreate);
    accountsTable.grantReadData(accountsList);
    accountsTable.grantReadData(accountsGet);
    accountsTable.grantReadWriteData(accountsUpdate);
    accountsTable.grantReadWriteData(accountsDelete);

    // ---------------------------------------------------------------------------
    // Transactions Lambdas
    // ---------------------------------------------------------------------------

    const transactionsCreate = fn(
      'TransactionsCreate',
      path.join(lambdaDir, 'transactions/create.ts'),
      { TRANSACTIONS_TABLE: transactionsTable.tableName },
    );
    const transactionsList = fn(
      'TransactionsList',
      path.join(lambdaDir, 'transactions/list.ts'),
      { TRANSACTIONS_TABLE: transactionsTable.tableName },
    );
    const transactionsGet = fn(
      'TransactionsGet',
      path.join(lambdaDir, 'transactions/get.ts'),
      { TRANSACTIONS_TABLE: transactionsTable.tableName },
    );
    const transactionsUpdate = fn(
      'TransactionsUpdate',
      path.join(lambdaDir, 'transactions/update.ts'),
      { TRANSACTIONS_TABLE: transactionsTable.tableName },
    );
    const transactionsDelete = fn(
      'TransactionsDelete',
      path.join(lambdaDir, 'transactions/delete.ts'),
      { TRANSACTIONS_TABLE: transactionsTable.tableName },
    );
    const transactionsTransfer = fn(
      'TransactionsTransfer',
      path.join(lambdaDir, 'transactions/transfer.ts'),
      { TRANSACTIONS_TABLE: transactionsTable.tableName },
    );
    const transactionsBulkUpdate = fn(
      'TransactionsBulkUpdate',
      path.join(lambdaDir, 'transactions/bulk-update.ts'),
      { TRANSACTIONS_TABLE: transactionsTable.tableName },
    );
    const transactionsConvert = fn(
      'TransactionsConvert',
      path.join(lambdaDir, 'transactions/convert-to-transfer.ts'),
      { TRANSACTIONS_TABLE: transactionsTable.tableName },
    );

    transactionsTable.grantWriteData(transactionsCreate);
    transactionsTable.grantReadData(transactionsList);
    transactionsTable.grantReadData(transactionsGet);
    transactionsTable.grantReadWriteData(transactionsUpdate);
    transactionsTable.grantReadWriteData(transactionsDelete);
    transactionsTable.grantWriteData(transactionsTransfer);
    transactionsTable.grantReadWriteData(transactionsBulkUpdate);
    transactionsTable.grantReadWriteData(transactionsConvert);

    // ---------------------------------------------------------------------------
    // Categories Lambdas
    // ---------------------------------------------------------------------------

    const categoriesCreate = fn(
      'CategoriesCreate',
      path.join(lambdaDir, 'categories/create.ts'),
      { TABLE_NAME: categoriesTable.tableName },
    );
    const categoriesList = fn(
      'CategoriesList',
      path.join(lambdaDir, 'categories/list.ts'),
      { TABLE_NAME: categoriesTable.tableName },
    );
    const categoriesGet = fn(
      'CategoriesGet',
      path.join(lambdaDir, 'categories/get.ts'),
      { TABLE_NAME: categoriesTable.tableName },
    );
    const categoriesUpdate = fn(
      'CategoriesUpdate',
      path.join(lambdaDir, 'categories/update.ts'),
      { TABLE_NAME: categoriesTable.tableName },
    );
    const categoriesDelete = fn(
      'CategoriesDelete',
      path.join(lambdaDir, 'categories/delete.ts'),
      { TABLE_NAME: categoriesTable.tableName },
    );

    categoriesTable.grantWriteData(categoriesCreate);
    categoriesTable.grantReadData(categoriesList);
    categoriesTable.grantReadData(categoriesGet);
    categoriesTable.grantReadWriteData(categoriesUpdate);
    categoriesTable.grantReadWriteData(categoriesDelete);

    // ---------------------------------------------------------------------------
    // Budget Lambdas
    // ---------------------------------------------------------------------------

    const budgetCreate = fn(
      'BudgetCreate',
      path.join(lambdaDir, 'budget/create.ts'),
      { TABLE_NAME: budgetTable.tableName },
    );
    const budgetList = fn(
      'BudgetList',
      path.join(lambdaDir, 'budget/list.ts'),
      { TABLE_NAME: budgetTable.tableName },
    );
    const budgetGet = fn(
      'BudgetGet',
      path.join(lambdaDir, 'budget/get.ts'),
      { TABLE_NAME: budgetTable.tableName },
    );
    const budgetUpdate = fn(
      'BudgetUpdate',
      path.join(lambdaDir, 'budget/update.ts'),
      { TABLE_NAME: budgetTable.tableName },
    );
    const budgetDelete = fn(
      'BudgetDelete',
      path.join(lambdaDir, 'budget/delete.ts'),
      { TABLE_NAME: budgetTable.tableName },
    );
    const budgetComparison = fn(
      'BudgetComparison',
      path.join(lambdaDir, 'budget/comparison.ts'),
      {
        TABLE_NAME: budgetTable.tableName,
        TABLE_NAME_TRANSACTIONS: transactionsTable.tableName,
      },
    );

    budgetTable.grantWriteData(budgetCreate);
    budgetTable.grantReadData(budgetList);
    budgetTable.grantReadData(budgetGet);
    budgetTable.grantReadWriteData(budgetUpdate);
    budgetTable.grantReadWriteData(budgetDelete);
    budgetTable.grantReadData(budgetComparison);
    transactionsTable.grantReadData(budgetComparison);

    // ---------------------------------------------------------------------------
    // Analytics Lambdas
    // ---------------------------------------------------------------------------

    const analyticsGet = fn(
      'AnalyticsGet',
      path.join(lambdaDir, 'analytics/get.ts'),
      { TRANSACTIONS_TABLE: transactionsTable.tableName },
    );

    transactionsTable.grantReadData(analyticsGet);

    // ---------------------------------------------------------------------------
    // API Gateway
    // ---------------------------------------------------------------------------

    const api = new apigateway.RestApi(this, 'DateTimeApi', {
      restApiName: 'Budget App Service',
      description: 'API to get current date and time',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type'],
      },
      deployOptions: {
        tracingEnabled: true,
      },
    });

    // --- Accounts routes ---
    const accountsResource = api.root.addResource('accounts');
    accountsResource.addMethod('POST', new apigateway.LambdaIntegration(accountsCreate));
    accountsResource.addMethod('GET', new apigateway.LambdaIntegration(accountsList));

    const accountResource = accountsResource.addResource('{accountId}');
    accountResource.addMethod('GET', new apigateway.LambdaIntegration(accountsGet));
    accountResource.addMethod('PUT', new apigateway.LambdaIntegration(accountsUpdate));
    accountResource.addMethod('DELETE', new apigateway.LambdaIntegration(accountsDelete));

    // --- Transactions routes ---
    const transactionsResource = api.root.addResource('transactions');
    transactionsResource.addMethod('POST', new apigateway.LambdaIntegration(transactionsCreate));
    transactionsResource.addMethod('GET', new apigateway.LambdaIntegration(transactionsList));

    // Static sub-resources must be defined before path parameters to avoid routing conflicts
    const transferResource = transactionsResource.addResource('transfer');
    transferResource.addMethod('POST', new apigateway.LambdaIntegration(transactionsTransfer));

    const bulkResource = transactionsResource.addResource('bulk');
    bulkResource.addMethod('PATCH', new apigateway.LambdaIntegration(transactionsBulkUpdate));

    const transactionResource = transactionsResource.addResource('{transactionId}');
    transactionResource.addMethod('GET', new apigateway.LambdaIntegration(transactionsGet));
    transactionResource.addMethod('PUT', new apigateway.LambdaIntegration(transactionsUpdate));
    transactionResource.addMethod('DELETE', new apigateway.LambdaIntegration(transactionsDelete));

    const convertToTransferResource = transactionResource.addResource('convert-to-transfer');
    convertToTransferResource.addMethod('POST', new apigateway.LambdaIntegration(transactionsConvert));

    // --- Categories routes ---
    const categoriesResource = api.root.addResource('categories');
    categoriesResource.addMethod('POST', new apigateway.LambdaIntegration(categoriesCreate));
    categoriesResource.addMethod('GET', new apigateway.LambdaIntegration(categoriesList));

    const categoryResource = categoriesResource.addResource('{categoryId}');
    categoryResource.addMethod('GET', new apigateway.LambdaIntegration(categoriesGet));
    categoryResource.addMethod('PUT', new apigateway.LambdaIntegration(categoriesUpdate));
    categoryResource.addMethod('DELETE', new apigateway.LambdaIntegration(categoriesDelete));

    // --- Budget routes ---
    const budgetResource = api.root.addResource('budget');
    budgetResource.addMethod('POST', new apigateway.LambdaIntegration(budgetCreate));
    budgetResource.addMethod('GET', new apigateway.LambdaIntegration(budgetList));

    // /budget/comparison must be before {budgetId} to avoid routing conflict
    const budgetComparisonResource = budgetResource.addResource('comparison');
    budgetComparisonResource.addMethod('GET', new apigateway.LambdaIntegration(budgetComparison));

    const budgetItemResource = budgetResource.addResource('{budgetId}');
    budgetItemResource.addMethod('GET', new apigateway.LambdaIntegration(budgetGet));
    budgetItemResource.addMethod('PUT', new apigateway.LambdaIntegration(budgetUpdate));
    budgetItemResource.addMethod('DELETE', new apigateway.LambdaIntegration(budgetDelete));

    // --- Analytics routes ---
    const analyticsResource = api.root.addResource('analytics');
    analyticsResource.addMethod('GET', new apigateway.LambdaIntegration(analyticsGet));

    // ---------------------------------------------------------------------------
    // Outputs
    // ---------------------------------------------------------------------------

    this.apiUrlOutput = new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
    });

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

    new cdk.CfnOutput(this, 'BudgetTableName', {
      value: budgetTable.tableName,
      description: 'DynamoDB table name for budget planner',
    });
  }
}
