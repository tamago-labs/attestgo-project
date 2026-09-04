import { defineFunction, secret } from "@aws-amplify/backend";

export const sumsubGetApplicantStatus = defineFunction({
  name: "sumsubGetApplicantStatus",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 30,
  environment: {
    SUMSUB_BASE_URL: "https://api.sumsub.com",
    SUMSUB_LEVEL: "basic-attestgo",
    SUMSUB_APP_TOKEN: secret("SUMSUB_APP_TOKEN"),
    SUMSUB_SECRET_KEY: secret("SUMSUB_SECRET_KEY"),
  },
});
