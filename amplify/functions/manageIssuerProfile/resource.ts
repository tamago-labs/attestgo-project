import { defineFunction, secret } from "@aws-amplify/backend";

export const manageIssuerProfile = defineFunction({
  name: "manageIssuerProfile",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 30,
  environment: {
    PLATFORM_API_KEY: secret("PLATFORM_API_KEY"),
  },
});
