import { defineFunction, secret } from "@aws-amplify/backend";

export const attestPass = defineFunction({
  name: "attestPass",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 300,
  environment: {
    GOPASS_ADDR: "0x343B31905A1c9EdDA115027A14F8a4a1e0519cD5",
    GOPASS_REGISTRY_ADDR: "0xB5532d57262E2C05CBda2C7ffED40D2F322b3594",
    SEPOLIA_RPC_URL: secret("SEPOLIA_RPC_URL"),
    CREDITCOIN_RPC_URL: "https://rpc.cc3-testnet.creditcoin.network",
    PROOF_BUILDER_URL: "https://prover.cc3-testnet.creditcoin.network",
    OWNER_PK: secret("OWNER_PK"),
  },
});
