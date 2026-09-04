import { defineFunction, secret } from "@aws-amplify/backend";

export const mintPass = defineFunction({
  name: "mintPass",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 60,
  environment: {
    GOPASS_ADDR: "0x0a6aD3b8B8D1A69Ba44002983e64e4824cB63334",
    SEPOLIA_RPC_URL: secret("SEPOLIA_RPC_URL"),
    OWNER_PK: secret("OWNER_PK"),
  },
});
