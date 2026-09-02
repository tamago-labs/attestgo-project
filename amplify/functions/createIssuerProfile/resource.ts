import { defineFunction } from "@aws-amplify/backend";

export const createIssuerProfile = defineFunction({
  name: "createIssuerProfile",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 30,
});
