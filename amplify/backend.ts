import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { mintPass } from './functions/mintPass/resource.js';
import { attestPass } from './functions/attestPass/resource.js';
import { createGToken } from './functions/createGToken/resource.js';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

const backend = defineBackend({
  auth,
  data,
  mintPass,
  attestPass,
  createGToken,
});

// REST API POST /tokens — separate key PLATFORM_API_KEY (secret), not the Data apiKey
const apiStack = backend.createStack('TokenApiStack');
const api = new apigateway.RestApi(apiStack, 'TokenRestApi', {
  restApiName: 'token-api',
  deployOptions: { stageName: 'prod' },
  defaultCorsPreflightOptions: {
    allowOrigins: apigateway.Cors.ALL_ORIGINS,
    allowMethods: apigateway.Cors.ALL_METHODS,
    allowHeaders: ['Content-Type', 'x-api-key', 'x-platform-api-key', 'Authorization'],
  },
});
const tokens = api.root.addResource('tokens');
tokens.addMethod('POST', new apigateway.LambdaIntegration(backend.createGToken.resources.lambda));
tokens.addMethod('GET', new apigateway.LambdaIntegration(backend.createGToken.resources.lambda));
// also support POST /createGToken alias
const cgt = api.root.addResource('createGToken');
cgt.addMethod('POST', new apigateway.LambdaIntegration(backend.createGToken.resources.lambda));
cgt.addMethod('GET', new apigateway.LambdaIntegration(backend.createGToken.resources.lambda));

backend.addOutput({
  custom: {
    tokenApiUrl: api.url,
  },
});
