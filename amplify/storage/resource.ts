import { defineStorage } from "@aws-amplify/backend";

export const storage = defineStorage({
  name: "attestgoFiles",
  access: (allow) => ({
    "docs/*": [
      allow.guest.to(["read", "write"]),
    ],
  }),
});
