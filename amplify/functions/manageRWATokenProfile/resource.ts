import { defineFunction, secret } from "@aws-amplify/backend";

export const manageRWATokenProfile = defineFunction({
  name: "manageRWATokenProfile",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 30,
  environment: {
    PLATFORM_API_KEY: secret("PLATFORM_API_KEY"),
  },
});
