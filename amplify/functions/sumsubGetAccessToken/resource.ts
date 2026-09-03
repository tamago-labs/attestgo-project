import { defineFunction, secret } from "@aws-amplify/backend";

export const sumsubGetAccessToken = defineFunction({
  name: "sumsubGetAccessToken",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 30,
  environment: {
    SUMSUB_APP_TOKEN: secret("SUMSUB_APP_TOKEN"),
    SUMSUB_SECRET_KEY: secret("SUMSUB_SECRET_KEY"),
    SUMSUB_LEVEL: "basic-attestgo",
    SUMSUB_BASE_URL: "https://api.sumsub.com",
  },
});
