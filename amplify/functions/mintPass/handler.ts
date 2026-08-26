import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/mintPass";
import { ethers, keccak256, toUtf8Bytes } from "ethers";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);

Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

const GOPASS_ABI = [
  "function mint(address to, tuple(uint8 tier, uint8 subTier, bytes2 group, bytes2 subGroup, uint256 countryBitmap, uint64 expiry, bool frozen, bool active, bytes32 customerIdHash, string kycSource) r) external",
  "function recordHash(address) view returns (bytes32)",
] as const;

const COUNTRY_BIT: Record<string, number> = { US: 0, SG: 1, JP: 2, HK: 3, DE: 4, CN: 5, GB: 6, FR: 7, AE: 8, CH: 9 };

function bitmap(country: string): bigint {
  const bit = COUNTRY_BIT[country.toUpperCase()];
  if (bit === undefined) throw new Error(`country not mapped: ${country}`);
  return 1n << BigInt(bit);
}

type Args = { userProfileId: string };

export const handler: Schema["mintPass"]["functionHandler"] = async (event) => {
  const { userProfileId } = event.arguments as Args;
  if (!userProfileId) throw new Error("userProfileId required");

  const { data: profile } = await client.models.UserProfile.get({ id: userProfileId });
  if (!profile) throw new Error("UserProfile not found");
  const walletAddress = (profile as unknown as { walletAddress: string }).walletAddress;
  const country = (profile as unknown as { country: string }).country;

  const gopassAddr = env.GOPASS_ADDR;
  const rpc = env.SEPOLIA_RPC_URL;
  const pk = env.OWNER_PK;
  if (!pk) throw new Error("OWNER_PK secret not set");

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const gopass = new ethers.Contract(gopassAddr, GOPASS_ABI, wallet);

  const expiry = BigInt(Math.floor(Date.now() / 1000) + 365 * 86400);
  const customerIdHash = keccak256(toUtf8Bytes(userProfileId));
  const bm = bitmap(country);

  const record = {
    tier: 10,
    subTier: 0,
    group: "0x0000",
    subGroup: "0x0000",
    countryBitmap: bm,
    expiry,
    frozen: false,
    active: false,
    customerIdHash,
    kycSource: "sumsub",
  };

  const existing = await (gopass as unknown as { recordHash: (a: string) => Promise<string> }).recordHash(walletAddress);
  if (existing && existing !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("already minted");
  }

  const tx = await (gopass as unknown as { mint: (a: string, b: unknown) => Promise<ethers.TransactionResponse> }).mint(walletAddress, record);
  const receipt = await tx.wait();
  if (!receipt) throw new Error("tx failed");

  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    recordHash: customerIdHash,
  };
};
