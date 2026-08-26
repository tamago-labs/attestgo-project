import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { mintPass } from "../functions/mintPass/resource";
import { attestPass } from "../functions/attestPass/resource";
import { createGToken } from "../functions/createGToken/resource";

const schema = a.schema({
  UserProfile: a
    .model({
      walletAddress: a.string().required(),
      displayName: a.string().required(),
      country: a.string().required(),
      message: a.string().required(),
      signature: a.string().required(),
      request: a.hasOne("PassRequest", "userProfileId"),
    })
    .authorization((allow) => [allow.publicApiKey().to(["read", "create", "update", "delete"])])
    .secondaryIndexes((index) => [index("walletAddress").queryField("byWallet")]),

  PassRequest: a
    .model({
      userProfileId: a.id().required(),
      userProfile: a.belongsTo("UserProfile", "userProfileId"),
      chainId: a.integer().required(),
      txHash: a.string().required(),
      blockNumber: a.integer().required(),
      recordHash: a.string().required(),
      status: a.enum(["pending", "active"]),
    })
    .authorization((allow) => [allow.publicApiKey().to(["read", "create", "update"])])
    .secondaryIndexes((index) => [index("userProfileId").queryField("byUserProfile")]),

  mintPass: a
    .mutation()
    .arguments({ userProfileId: a.id().required() })
    .returns(a.json())
    .handler(a.handler.function(mintPass))
    .authorization((allow) => [allow.publicApiKey()]),

  attestPass: a
    .mutation()
    .arguments({ userProfileId: a.id().required() })
    .returns(a.json())
    .handler(a.handler.function(attestPass))
    .authorization((allow) => [allow.publicApiKey()]),

  TokenRecord: a
    .model({
      tokenAddress: a.string().required(),
      chainId: a.integer().required(),
      factoryAddress: a.string().required(),
      issuer: a.string().required(),
      name: a.string().required(),
      symbol: a.string().required(),
      decimals: a.integer().required(),
      underlying: a.string(),
      isWrapped: a.boolean().required(),
      iconURI: a.string(),
      ruleMinTier: a.integer().required(),
      ruleBitmap: a.string().required(),
      txHash: a.string().required(),
      blockNumber: a.integer().required(),
    })
    .authorization((allow) => [allow.publicApiKey().to(["read"])])
    .secondaryIndexes((index) => [
      index("issuer").queryField("listByIssuer"),
      index("chainId").queryField("listByChain"),
    ]),
}).authorization((allow) => [allow.resource(mintPass), allow.resource(attestPass), allow.resource(createGToken)]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "apiKey",
    apiKeyAuthorizationMode: {
      expiresInDays: 30,
    },
  },
});
