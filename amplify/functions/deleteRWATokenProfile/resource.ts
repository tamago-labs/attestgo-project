import { defineFunction } from "@aws-amplify/backend";

export const deleteRWATokenProfile = defineFunction({
  name: "deleteRWATokenProfile",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 30,
});
