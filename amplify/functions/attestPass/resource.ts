import { defineFunction, secret } from "@aws-amplify/backend";

export const attestPass = defineFunction({
  name: "attestPass",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 300,
  environment: {
    GOPASS_ADDR: "0x9236590Ffa4FA7B633F1F6ce3a23338b532a5302",
    GOPASS_REGISTRY_ADDR: "0xF3475177692D1D88a34c4E9a508D4ee6d17DFB68",
    SEPOLIA_RPC_URL: secret("SEPOLIA_RPC_URL"),
    CREDITCOIN_RPC_URL: "https://rpc.cc3-testnet.creditcoin.network",
    PROOF_BUILDER_URL: "https://prover.cc3-testnet.creditcoin.network",
    OWNER_PK: secret("OWNER_PK"),
  },
});
