import { defineFunction, secret } from "@aws-amplify/backend";

export const attestLock = defineFunction({
  name: "attestLock",
  entry: "./handler.ts",
  runtime: 22,
  timeoutSeconds: 300,
  environment: {
    SOURCE_VAULT_ADDR: "0xd81F1A1a63fB33989bF46432527A6F7E997cF6ED",
    CORE_VAULT_ADDR: "0x51062701163469d30a0c4331BB2FBab215d24434",
    CUSDT_CC: "0x60f6456FBE5566e515E63219fC9c0dbb80015F8E",
    ATC_CC: "0x3f0e699Ad6F14324c93A23Cd57aef60Ffa09DA6a",
    GTOKEN_AN225: "0xc55D7821b6e0D8AC162e5b672aa9ea87a066b5a8",
    GTOKEN_ATBILL: "0x266F1BA9Cd984D8DC9cb7029A7c69e9d216283Db",
    ORACLE_AN225: "0x4865dc0C4A3B11CF6FB57Dec180577f4824bB082",
    ORACLE_ATBILL: "0xc1D218017533dA1F61ba28125bcCcEC0FB3874B2",
    IRM_ADDR: "0x3345A6582669C00cA022d9200C083b3097B18DBb",
    LLTV: "620000000000000000",
    CREDITCOIN_RPC_URL: "https://rpc.cc3-testnet.creditcoin.network",
    SEPOLIA_RPC_URL: secret("SEPOLIA_RPC_URL"),
    PROOF_BUILDER_URL: "https://prover.cc3-testnet.creditcoin.network",
    OWNER_PK: secret("OWNER_PK"),
  },
});
