import { defineFunction } from "@aws-amplify/backend";

export const createRWATokenProfile = defineFunction({
  name: "createRWATokenProfile",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 30,
});
