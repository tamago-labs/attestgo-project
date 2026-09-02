import { defineFunction } from "@aws-amplify/backend";

export const updateRWATokenProfile = defineFunction({
  name: "updateRWATokenProfile",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 30,
});
