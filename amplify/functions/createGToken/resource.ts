import { defineFunction, secret } from "@aws-amplify/backend";

export const createGToken = defineFunction({
  name: "createGToken",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 60,
  environment: {
    FACTORY_ADDR: "0x7843c062939FCBfA150c962a4214d2e14714A820",
    CHAIN_ID: "11155111",
    SEPOLIA_RPC_URL: secret("SEPOLIA_RPC_URL"),
    OWNER_PK: secret("OWNER_PK"),
    PLATFORM_API_KEY: secret("PLATFORM_API_KEY"),
  },
});
