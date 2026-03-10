import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  stackEnv: 'prod' | 'qa';
}

export class AuthStack extends cdk.Stack {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const isQa = props.stackEnv === 'qa';
    const suffix = isQa ? '-QA' : '';

    // ── Cognito User Pool ───────────────────────────────────────────────────
    this.userPool = new cognito.UserPool(this, 'BudgetUserPool', {
      userPoolName: `BudgetUsers${suffix}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: isQa ? cdk.RemovalPolicy.DESTROY : cdk.RemovalPolicy.RETAIN,
    });

    // ── Hosted UI domain ────────────────────────────────────────────────────
    const domainPrefix = isQa ? 'budget-matteo-cool-qa' : 'budget-matteo-cool';
    const domain = this.userPool.addDomain('CognitoDomain', {
      cognitoDomain: { domainPrefix },
    });

    // ── App Client (PKCE only) ──────────────────────────────────────────────
    const callbackUrls = isQa
      ? ['http://localhost:3000/callback', 'http://localhost:4200/callback']
      : [
          'https://budget.matteo.cool/callback',
          'http://localhost:3000/callback',
          'http://localhost:4200/callback',
        ];

    const logoutUrls = isQa
      ? ['http://localhost:3000/login', 'http://localhost:4200/login']
      : [
          'https://budget.matteo.cool/login',
          'http://localhost:3000/login',
          'http://localhost:4200/login',
        ];

    this.userPoolClient = this.userPool.addClient('BudgetAppClient', {
      userPoolClientName: `BudgetApp${suffix}`,
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls,
        logoutUrls,
      },
      authFlows: { userSrp: true },
      preventUserExistenceErrors: true,
    });

    // ── SSM Parameters (for pipeline to inject into frontend build) ─────────
    const ssmPrefix = isQa ? '/budget/qa/cognito' : '/budget/cognito';

    new ssm.StringParameter(this, 'SsmCognitoDomain', {
      parameterName: `${ssmPrefix}/domain`,
      stringValue: `${domainPrefix}.auth.${this.region}.amazoncognito.com`,
    });

    new ssm.StringParameter(this, 'SsmCognitoClientId', {
      parameterName: `${ssmPrefix}/clientId`,
      stringValue: this.userPoolClient.userPoolClientId,
    });

    new ssm.StringParameter(this, 'SsmCognitoUserPoolId', {
      parameterName: `${ssmPrefix}/userPoolId`,
      stringValue: this.userPool.userPoolId,
    });

    // ── Outputs ─────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: domain.baseUrl(),
    });
  }
}
