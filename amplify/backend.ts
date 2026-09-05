import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource.js';
import { data } from './data/resource.js';
import { mintPass } from './functions/mintPass/resource.js';
import { attestPass } from './functions/attestPass/resource.js';
import { attestLock } from './functions/attestLock/resource.js';
import { createGToken } from './functions/createGToken/resource.js';
import { manageIssuerProfile } from './functions/manageIssuerProfile/resource.js';
import { manageRWATokenProfile } from './functions/manageRWATokenProfile/resource.js';
import { postAnnouncement } from './functions/postAnnouncement/resource.js';
import { sumsubCreateApplicant } from './functions/sumsubCreateApplicant/resource.js';
import { sumsubGetAccessToken } from './functions/sumsubGetAccessToken/resource.js';
import { sumsubGetApplicantStatus } from './functions/sumsubGetApplicantStatus/resource.js';
import { sumsubWebhook } from './functions/sumsubWebhook/resource.js';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

const backend = defineBackend({
  auth,
  data,
  mintPass,
  attestPass,
  attestLock,
  createGToken,
  manageIssuerProfile,
  manageRWATokenProfile,
  postAnnouncement,
  sumsubCreateApplicant,
  sumsubGetAccessToken,
  sumsubGetApplicantStatus,
  sumsubWebhook,
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

// Issuer & RWA REST via PLATFORM_API_KEY  — matches app/docs/page.tsx contract
const issuers = api.root.addResource('issuers');
issuers.addMethod('POST', new apigateway.LambdaIntegration(backend.manageIssuerProfile.resources.lambda));
issuers.addMethod('GET', new apigateway.LambdaIntegration(backend.manageIssuerProfile.resources.lambda));
const issuersId = issuers.addResource('{id}');
issuersId.addMethod('PATCH', new apigateway.LambdaIntegration(backend.manageIssuerProfile.resources.lambda));
issuersId.addMethod('GET', new apigateway.LambdaIntegration(backend.manageIssuerProfile.resources.lambda));
const listings = api.root.addResource('listings');
listings.addMethod('POST', new apigateway.LambdaIntegration(backend.manageRWATokenProfile.resources.lambda));
listings.addMethod('GET', new apigateway.LambdaIntegration(backend.manageRWATokenProfile.resources.lambda));
const listingsId = listings.addResource('{id}');
listingsId.addMethod('PATCH', new apigateway.LambdaIntegration(backend.manageRWATokenProfile.resources.lambda));
listingsId.addMethod('DELETE', new apigateway.LambdaIntegration(backend.manageRWATokenProfile.resources.lambda));
listingsId.addMethod('GET', new apigateway.LambdaIntegration(backend.manageRWATokenProfile.resources.lambda));
const feed = api.root.addResource('feed');
feed.addMethod('POST', new apigateway.LambdaIntegration(backend.postAnnouncement.resources.lambda));
feed.addMethod('GET', new apigateway.LambdaIntegration(backend.postAnnouncement.resources.lambda));
const feedId = feed.addResource('{id}');
const feedReplies = feedId.addResource('replies');
feedReplies.addMethod('POST', new apigateway.LambdaIntegration(backend.postAnnouncement.resources.lambda));
feedReplies.addMethod('GET', new apigateway.LambdaIntegration(backend.postAnnouncement.resources.lambda));

// Sumsub webhook: POST /webhooks/sumsub
const webhooks = api.root.addResource('webhooks');
const sumsub = webhooks.addResource('sumsub');
sumsub.addMethod('POST', new apigateway.LambdaIntegration(backend.sumsubWebhook.resources.lambda));

backend.addOutput({
  custom: {
    tokenApiUrl: api.url,
    sumsubWebhookUrl: `${api.url}webhooks/sumsub`,
  },
});
