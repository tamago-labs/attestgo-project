import { defineFunction } from "@aws-amplify/backend";

export const updateIssuerProfile = defineFunction({
  name: "updateIssuerProfile",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 30,
});
