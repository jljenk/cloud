import { defineBackend } from '@aws-amplify/backend';
import { Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import { CorsHttpMethod, HttpApi, HttpMethod, HttpStage } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { wordCloudApi } from './functions/wordcloud-api/resource.ts';

/**
 * Pay-per-request only. Amplify Data is intentionally unused: its DynamoDB
 * tables default to provisioned capacity, which bills while the app is idle.
 */
const backend = defineBackend({
  wordCloudApi,
});

const functionStack = Stack.of(backend.wordCloudApi.resources.lambda);

const table = new Table(functionStack, 'WordClouds', {
  partitionKey: { name: 'id', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  removalPolicy: RemovalPolicy.RETAIN,
});

backend.wordCloudApi.addEnvironment('TABLE_NAME', table.tableName);
table.grantReadWriteData(backend.wordCloudApi.resources.lambda);

const apiStack = backend.createStack('api-stack');
const integration = new HttpLambdaIntegration(
  'WordCloudIntegration',
  backend.wordCloudApi.resources.lambda,
);

const httpApi = new HttpApi(apiStack, 'WordCloudHttpApi', {
  corsPreflight: {
    allowHeaders: ['content-type', 'x-admin-secret'],
    allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
    allowOrigins: ['*'],
    maxAge: Duration.days(1),
  },
  createDefaultStage: false,
});

httpApi.addRoutes({
  path: '/clouds',
  methods: [HttpMethod.POST],
  integration,
});

httpApi.addRoutes({
  path: '/clouds/{proxy+}',
  methods: [HttpMethod.GET, HttpMethod.POST],
  integration,
});

const stage = new HttpStage(apiStack, 'DefaultStage', {
  httpApi,
  stageName: '$default',
  autoDeploy: true,
  throttle: {
    burstLimit: 10,
    rateLimit: 5,
  },
});

backend.addOutput({
  custom: {
    apiUrl: stage.url,
  },
});
