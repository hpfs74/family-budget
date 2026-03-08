import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

// API Gateway endpoint (without stage path)
const API_GATEWAY_HOST = '2fq77pd4al.execute-api.eu-south-1.amazonaws.com';
const API_GATEWAY_STAGE = '/prod';

interface FrontendStackProps extends cdk.StackProps {
  certificate: acm.ICertificate;
}

export class FrontendStack extends cdk.Stack {
  public readonly bucketName: string;
  public readonly distributionId: string;

  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: 'Z2T8X72UH7FONU',
      zoneName: 'matteo.cool',
    });

    // ── S3 bucket (private, served via CloudFront OAC) ────────────────
    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `budget-matteo-cool-${cdk.Stack.of(this).account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
    });

    // ── CloudFront Function: strip /api prefix before forwarding ──────
    const apiRewriteFn = new cloudfront.Function(this, 'ApiRewriteFunction', {
      functionName: 'budget-api-path-rewrite',
      comment: 'Strip /api prefix so CloudFront forwards to API Gateway correctly',
      code: cloudfront.FunctionCode.fromInline(
        `function handler(event) {
  var req = event.request;
  req.uri = req.uri.replace(/^\\/api/, '') || '/';
  return req;
}`
      ),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // ── Origins ───────────────────────────────────────────────────────
    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

    const apiOrigin = new origins.HttpOrigin(API_GATEWAY_HOST, {
      originPath: API_GATEWAY_STAGE,
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
    });

    // ── CloudFront Distribution ───────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: 'budget.matteo.cool',
      domainNames: ['budget.matteo.cool'],
      certificate: props.certificate,
      defaultRootObject: 'index.html',

      // Default: serve frontend from S3
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },

      // /api/* → API Gateway (no cache, all methods, path rewrite)
      additionalBehaviors: {
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          functionAssociations: [
            {
              function: apiRewriteFn,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
        },
      },

      // SPA fallback: 403/404 → index.html (client-side routing)
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0),
        },
      ],

      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    this.bucketName = bucket.bucketName;
    this.distributionId = distribution.distributionId;

    // ── Route 53 alias record ─────────────────────────────────────────
    new route53.ARecord(this, 'ARecord', {
      zone: hostedZone,
      recordName: 'budget',
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });

    // ── AAAA (IPv6) ───────────────────────────────────────────────────
    new route53.AaaaRecord(this, 'AaaaRecord', {
      zone: hostedZone,
      recordName: 'budget',
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution)
      ),
    });

    // ── Outputs ───────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket name for frontend assets',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID',
    });

    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront domain name',
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: 'https://budget.matteo.cool',
      description: 'Public URL of the frontend',
    });
  }
}
