import { defineFunction, secret } from "@aws-amplify/backend";

export const sumsubWebhook = defineFunction({
  name: "sumsubWebhook",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 30,
  environment: {
    SUMSUB_SECRET_KEY: secret("SUMSUB_SECRET_KEY"),
  },
});
