import { type ClientSchema, a, defineData } from "@aws-amplify/backend";
import { mintPass } from "../functions/mintPass/resource";
import { attestPass } from "../functions/attestPass/resource";
import { createGToken } from "../functions/createGToken/resource";
import { manageIssuerProfile } from "../functions/manageIssuerProfile/resource";
import { manageRWATokenProfile } from "../functions/manageRWATokenProfile/resource";
import { postAnnouncement } from "../functions/postAnnouncement/resource";

const schema = a.schema({
  UserProfile: a
    .model({
      walletAddress: a.string().required(),
      displayName: a.string().required(),
      country: a.string().required(),
      message: a.string().required(),
      signature: a.string().required(),
      request: a.hasOne("PassRequest", "userProfileId"),
      addressBook: a.hasMany("AddressBookEntry", "ownerId"),
      registry: a.hasMany("UserTokenRegistry", "userProfileId"),
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

  AddressBookEntry: a
    .model({
      ownerId: a.id().required(),
      owner: a.belongsTo("UserProfile", "ownerId"),
      contactAddress: a.string().required(),
      label: a.string(),
    })
    .authorization((allow) => [allow.publicApiKey().to(["read", "create", "update", "delete"])])
    .secondaryIndexes((index) => [
      index("ownerId").queryField("listByOwner"),
      index("contactAddress").queryField("byContact"),
    ]),

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
      subscribers: a.hasMany("UserTokenRegistry", "tokenRecordId"),
      rwaProfile: a.hasOne("RWATokenProfile", "tokenRecordId"),
    })
    .authorization((allow) => [allow.publicApiKey().to(["read"])])
    .secondaryIndexes((index) => [
      index("issuer").queryField("listByIssuer"),
      index("chainId").queryField("listByChain"),
    ]),

  UserTokenRegistry: a
    .model({
      userProfileId: a.id().required(),
      userProfile: a.belongsTo("UserProfile", "userProfileId"),
      tokenRecordId: a.id(),
      tokenRecord: a.belongsTo("TokenRecord", "tokenRecordId"),
      tokenAddress: a.string().required(),
      chainId: a.integer().required(),
      isCustom: a.boolean().required(),
      symbol: a.string().required(),
      name: a.string(),
      decimals: a.integer(),
      addedAt: a.datetime(),
    })
    .authorization((allow) => [allow.publicApiKey().to(["read", "create", "delete"])])
    .secondaryIndexes((index) => [
      index("userProfileId").queryField("listMyTokens"),
      index("tokenAddress").queryField("byTokenAddress"),
      index("tokenRecordId").queryField("byTokenRecord"),
    ]),

  RWAIssuerProfile: a
    .model({
      issuerName: a.string().required(),
      handle: a.string().required(),
      logoURI: a.string(),
      website: a.string(),
      description: a.string(),
      ownerWallet: a.string().required(),
      status: a.enum(["pending", "verified", "rejected"]),
      verifiedAt: a.datetime(),
      tokens: a.hasMany("RWATokenProfile", "issuerProfileId"),
      announcements: a.hasMany("IssuerAnnouncement", "issuerProfileId"),
    })
    .authorization((allow) => [allow.publicApiKey().to(["read", "create", "update", "delete"])])
    .secondaryIndexes((index) => [
      index("handle").queryField("byHandle"),
      index("ownerWallet").queryField("byOwnerWallet"),
      index("status").queryField("byStatus"),
    ]),

  RWATokenProfile: a
    .model({
      issuerProfileId: a.id().required(),
      issuerProfile: a.belongsTo("RWAIssuerProfile", "issuerProfileId"),
      tokenRecordId: a.id().required(),
      tokenRecord: a.belongsTo("TokenRecord", "tokenRecordId"),
      apy: a.string(),
      tvl: a.string(),
      desc: a.string(),
      productUrl: a.string(),
      status: a.enum(["draft", "listed"]),
      announcements: a.hasMany("IssuerAnnouncement", "tokenProfileId"),
    })
    .authorization((allow) => [allow.publicApiKey().to(["read", "create", "update", "delete"])])
    .secondaryIndexes((index) => [
      index("issuerProfileId").queryField("listByIssuerProfile"),
      index("tokenRecordId").queryField("byTokenRecordId"),
      index("status").queryField("byTokenStatus"),
    ]),

  IssuerAnnouncement: a
    .model({
      issuerProfileId: a.id().required(),
      issuerProfile: a.belongsTo("RWAIssuerProfile", "issuerProfileId"),
      tokenProfileId: a.id(),
      tokenProfile: a.belongsTo("RWATokenProfile", "tokenProfileId"),
      text: a.string().required(),
      txHash: a.string(),
      likesCount: a.integer().required(),
      replies: a.hasMany("AnnouncementReply", "announcementId"),
    })
    .authorization((allow) => [allow.publicApiKey().to(["read", "create", "update", "delete"])])
    .secondaryIndexes((index) => [index("issuerProfileId").queryField("listByIssuerAnnouncement")]),

  AnnouncementReply: a
    .model({
      announcementId: a.id().required(),
      announcement: a.belongsTo("IssuerAnnouncement", "announcementId"),
      authorWallet: a.string().required(),
      text: a.string().required(),
    })
    .authorization((allow) => [allow.publicApiKey().to(["read", "create", "delete"])])
    .secondaryIndexes((index) => [index("announcementId").queryField("listByAnnouncement")]),

  createIssuerProfile: a
    .mutation()
    .arguments({ issuerName: a.string().required(), handle: a.string().required(), website: a.string(), description: a.string(), logoURI: a.string(), ownerWallet: a.string().required() })
    .returns(a.json())
    .handler(a.handler.function(manageIssuerProfile))
    .authorization((allow) => [allow.publicApiKey()]),
  updateIssuerProfile: a
    .mutation()
    .arguments({ issuerProfileId: a.id().required(), issuerName: a.string(), handle: a.string(), website: a.string(), description: a.string(), logoURI: a.string(), callerWallet: a.string() })
    .returns(a.json())
    .handler(a.handler.function(manageIssuerProfile))
    .authorization((allow) => [allow.publicApiKey()]),
  createRWATokenListing: a
    .mutation()
    .arguments({ issuerProfileId: a.id().required(), tokenRecordId: a.id().required(), apy: a.string(), tvl: a.string(), desc: a.string(), productUrl: a.string(), callerWallet: a.string() })
    .returns(a.json())
    .handler(a.handler.function(manageRWATokenProfile))
    .authorization((allow) => [allow.publicApiKey()]),
  updateRWATokenListing: a
    .mutation()
    .arguments({ tokenProfileId: a.id().required(), apy: a.string(), tvl: a.string(), desc: a.string(), productUrl: a.string(), status: a.string(), callerWallet: a.string() })
    .returns(a.json())
    .handler(a.handler.function(manageRWATokenProfile))
    .authorization((allow) => [allow.publicApiKey()]),
  deleteRWATokenListing: a
    .mutation()
    .arguments({ tokenProfileId: a.id().required(), callerWallet: a.string() })
    .returns(a.json())
    .handler(a.handler.function(manageRWATokenProfile))
    .authorization((allow) => [allow.publicApiKey()]),
  postAnnouncement: a
    .mutation()
    .arguments({ issuerProfileId: a.id().required(), tokenProfileId: a.id(), text: a.string().required(), txHash: a.string(), callerWallet: a.string() })
    .returns(a.json())
    .handler(a.handler.function(postAnnouncement))
    .authorization((allow) => [allow.publicApiKey()]),
}).authorization((allow) => [allow.resource(mintPass), allow.resource(attestPass), allow.resource(createGToken), allow.resource(manageIssuerProfile), allow.resource(manageRWATokenProfile), allow.resource(postAnnouncement)]);

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
