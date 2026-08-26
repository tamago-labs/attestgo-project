import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { mintPass } from "../functions/mintPass/resource";

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
});

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
