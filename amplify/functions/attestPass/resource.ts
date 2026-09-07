import { defineFunction, secret } from "@aws-amplify/backend";

export const attestPass = defineFunction({
  name: "attestPass",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 300,
  environment: {
    GOPASS_ADDR: "0x0a6aD3b8B8D1A69Ba44002983e64e4824cB63334",
    GOPASS_REGISTRY_ADDR: "0x317BeB1889C65AC1e6661d0D7307de861dA0db8d",
    SEPOLIA_RPC_URL: secret("SEPOLIA_RPC_URL"),
    CREDITCOIN_RPC_URL: "https://rpc.cc3-testnet.creditcoin.network",
    PROOF_BUILDER_URL: "https://prover.cc3-testnet.creditcoin.network",
    OWNER_PK: secret("OWNER_PK"),
  },
});
