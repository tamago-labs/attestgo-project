import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/attestPass";
import { ethers } from "ethers";
import { proofProvider, blockProver } from "@gluwa/usc-sdk";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

const GOPASS_ABI = [
  "function getRecord(address) view returns (tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bool active,bytes32 customerIdHash,string kycSource))",
  "function setActive(address wallet, bool active) external",
] as const;

const REGISTRY_ABI = [
  "function syncPassWithTxProof(address wallet, tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bool active,bytes32 customerIdHash,string kycSource) r, uint64 headerNumber, bytes txBytes, bytes32 merkleRoot, tuple(bytes32 hash,bool isLeft)[] siblings, bytes32 lowerDigest, bytes32[] roots) external",
] as const;

export const handler: Schema["attestPass"]["functionHandler"] = async (event) => {
  console.log("[attestPass] invoke", JSON.stringify((event as unknown as { arguments: unknown }).arguments));
  const { userProfileId } = event.arguments as { userProfileId: string };
  if (!userProfileId) throw new Error("userProfileId required");

  const { data: profile } = await client.models.UserProfile.get({ id: userProfileId });
  if (!profile) throw new Error("UserProfile not found");
  const walletAddress = (profile as unknown as { walletAddress: string }).walletAddress;

  const { data: rowsRaw } = (await client.models.PassRequest.list({ filter: { userProfileId: { eq: userProfileId } } })) as unknown as { data: { id: string; txHash: string; status: string }[] };
  const req = rowsRaw?.[0];
  if (!req) throw new Error("PassRequest not found");
  if (req.status === "active") return JSON.stringify({ status: "active", txHash: req.txHash });

  const sepolia = new ethers.JsonRpcProvider(env.SEPOLIA_RPC_URL as string);
  const cc = new ethers.JsonRpcProvider(env.CREDITCOIN_RPC_URL as string);

  // follow 3_worker_sync.ts: build tuple from getRecord
  const hub = new ethers.Contract(env.GOPASS_ADDR as string, GOPASS_ABI, sepolia);
  const rec: any = await (hub as any).getRecord(walletAddress);
  const tuple = {
    tier: rec.tier,
    subTier: rec.subTier,
    group: rec.group,
    subGroup: rec.subGroup,
    countryBitmap: rec.countryBitmap,
    expiry: rec.expiry,
    frozen: rec.frozen,
    active: rec.active,
    customerIdHash: rec.customerIdHash,
    kycSource: rec.kycSource || "",
  };

  const txHash = req.txHash;
  const builder = new proofProvider.service.ProofBuilder(1, env.PROOF_BUILDER_URL as string, 5000);
  const res = await builder.getProof(txHash);
  if (!res.success || !res.data) {
    const rawErr = String((res as unknown as { error: string }).error || "");
    const is404 = rawErr.includes("404") || rawErr.toLowerCase().includes("not yet attested") || rawErr.toLowerCase().includes("not yet");
    console.warn("[attestPass] proof not ready", rawErr);
    if (is404) {
      // like 3_worker_sync.ts waitUntilHeightAttested — return pending cleanly so frontend shows friendly message instead of Lambda:Unhandled
      return JSON.stringify({ status: "pending", txHash, reason: rawErr.slice(0, 300), blockNumber: (req as unknown as { blockNumber: number }).blockNumber });
    }
    throw new Error(`Proof generation failed: ${rawErr}`);
  }
  const d = res.data as any;
  console.log("[attestPass] proof header", d.headerNumber, "siblings", d.merkleProof.siblings.length);

  const prover = new blockProver.PrecompileBlockProver(cc);
  const ok = await prover.verifySingle(d.chainKey, d.headerNumber, d.txBytes, d.merkleProof, d.continuityProof);
  if (!ok) throw new Error("verifySingle failed");
  console.log("[attestPass] verify true");

  const pk = env.OWNER_PK as string;
  const owner = new ethers.Wallet(pk, cc);
  const registry = new ethers.Contract(env.GOPASS_REGISTRY_ADDR as string, REGISTRY_ABI, owner);
  const tx1 = await (registry as any).syncPassWithTxProof(
    walletAddress,
    tuple,
    d.headerNumber,
    d.txBytes,
    d.merkleProof.root,
    d.merkleProof.siblings.map((s: any) => ({ hash: s.hash ?? s, isLeft: s.isLeft ?? false })),
    d.continuityProof.lowerEndpointDigest,
    d.continuityProof.roots
  );
  console.log("[attestPass] sync", tx1.hash);
  try {
    await tx1.wait(1, 120000);
  } catch (e) {
    console.warn("[attestPass] sync wait timeout/err", e);
  }

  const gopassOwner = new ethers.Contract(env.GOPASS_ADDR as string, GOPASS_ABI, new ethers.Wallet(pk, sepolia));
  const tx2 = await (gopassOwner as any).setActive(walletAddress, true);
  console.log("[attestPass] active", tx2.hash);
  try {
    await tx2.wait(1, 120000);
  } catch (e) {
    console.warn("[attestPass] active wait timeout/err", e);
  }

  // update before return even if waits timed out - frontend will see active on refresh/poll
  await client.models.PassRequest.update({ id: req.id, status: "active" } as unknown as { id: string; status: "active" });
  // also return registry/active hashes so frontend can show without extra fetch
  return JSON.stringify({ status: "active", txHash, registryTx: tx1.hash, activeTx: tx2.hash });
};
