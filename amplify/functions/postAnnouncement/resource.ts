import { defineFunction } from "@aws-amplify/backend";

export const postAnnouncement = defineFunction({
  name: "postAnnouncement",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 30,
});
