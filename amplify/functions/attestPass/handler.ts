import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../data/resource";
import { env } from "$amplify/env/attestPass";
import { ethers } from "ethers";
import { proofProvider, blockProver } from "@gluwa/usc-sdk";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

const GOPASS_ABI = [
  "function getRecord(address) view returns (tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bool active,bytes32 customerIdHash,string kycSource))",
  "function recordHash(address) view returns (bytes32)",
  "function setActive(address wallet, bool active) external",
] as const;

const REGISTRY_ABI = [
  "function syncPassWithTxProof(address wallet, tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bool active,bytes32 customerIdHash,string kycSource) r, uint64 headerNumber, bytes txBytes, bytes32 merkleRoot, bytes32[] siblings, bytes32 lowerDigest, bytes32[] roots) external",
] as const;

export const handler = async (event: { arguments: { userProfileId: string } }) => {
  const { userProfileId } = event.arguments;
  if (!userProfileId) throw new Error("userProfileId required");

  const { data: profile } = await client.models.UserProfile.get({ id: userProfileId });
  if (!profile) throw new Error("UserProfile not found");

  const pid = userProfileId;
  const { data: rows } = await (client.models.PassRequest as unknown as { byUserProfile: (a: { userProfileId: string }) => Promise<{ data: { id: string; txHash: string; blockNumber: number; status: string }[] }> }).byUserProfile({ userProfileId: pid }).catch(async () => {
    return client.models.PassRequest.list({ filter: { userProfileId: { eq: pid } } }) as unknown as { data: { id: string; txHash: string; blockNumber: number; status: string }[] };
  });
  const req = (rows as unknown as { id: string; txHash: string; blockNumber: number; status: string }[])?.[0];
  if (!req) throw new Error("PassRequest not found");
  if (req.status === "active") return { status: "active", txHash: req.txHash };

  const walletAddress = (profile as unknown as { walletAddress: string }).walletAddress;

  const sepolia = new ethers.JsonRpcProvider(env.SEPOLIA_RPC_URL as string);
  const cc = new ethers.JsonRpcProvider(env.CREDITCOIN_RPC_URL as string);

  const hub = new ethers.Contract(env.GOPASS_ADDR as string, GOPASS_ABI, sepolia);
  const record = await (hub as unknown as { getRecord: (a: string) => Promise<unknown> }).getRecord(walletAddress);

  const txHash = req.txHash;
  const builder = new proofProvider.service.ProofBuilder(1, env.PROOF_BUILDER_URL as string);

  const tx = await sepolia.getTransaction(txHash);
  if (!tx?.blockNumber) throw new Error(`tx ${txHash} not found on Sepolia`);

  const res = await builder.getProof(txHash);
  if (!res.success || !res.data) {
    const msg = String((res as unknown as { error: string }).error || "");
    if (msg.toLowerCase().includes("not yet attested") || msg.toLowerCase().includes("not yet") || msg.toLowerCase().includes("height")) {
      throw new Error(`not attested yet: ${msg}`);
    }
    throw new Error(`Proof generation failed: ${(res as unknown as { error: string }).error}`);
  }
  const d = res.data as unknown as { headerNumber: number; chainKey: number; txBytes: string; merkleProof: { root: string; siblings: { hash: string }[] }; continuityProof: { lowerEndpointDigest: string; roots: string[] } };

  const prover = new blockProver.PrecompileBlockProver(cc);
  const ok = await prover.verifySingle(d.chainKey, d.headerNumber, d.txBytes, d.merkleProof, d.continuityProof);
  if (!ok) throw new Error("verifySingle failed");

  const pk = env.OWNER_PK as string;
  if (!pk) throw new Error("OWNER_PK not set");
  const owner = new ethers.Wallet(pk, cc);
  const registry = new ethers.Contract(env.GOPASS_REGISTRY_ADDR as string, REGISTRY_ABI, owner);
  await (registry as unknown as { syncPassWithTxProof: (...a: unknown[]) => Promise<ethers.TransactionResponse> }).syncPassWithTxProof(
    walletAddress,
    record,
    d.headerNumber,
    d.txBytes,
    d.merkleProof.root,
    d.merkleProof.siblings.map((s: { hash: string } | string) => (typeof s === "string" ? s : s.hash)),
    d.continuityProof.lowerEndpointDigest,
    d.continuityProof.roots
  );

  const gopassOwner = new ethers.Contract(env.GOPASS_ADDR as string, GOPASS_ABI, new ethers.Wallet(pk, sepolia));
  await (gopassOwner as unknown as { setActive: (a: string, b: boolean) => Promise<ethers.TransactionResponse> }).setActive(walletAddress, true);

  await client.models.PassRequest.update({ id: req.id, status: "active" });

  return { status: "active", txHash };
};
