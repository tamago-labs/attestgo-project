import { defineFunction, secret } from "@aws-amplify/backend";

export const mintPass = defineFunction({
  name: "mintPass",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 60,
  environment: {
    GOPASS_ADDR: "0x343B31905A1c9EdDA115027A14F8a4a1e0519cD5",
    SEPOLIA_RPC_URL: secret("SEPOLIA_RPC_URL"),
    OWNER_PK: secret("OWNER_PK"),
  },
});
