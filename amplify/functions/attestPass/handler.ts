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
  "function recordHash(address) view returns (bytes32)",
  "function setActive(address wallet, bool active) external",
] as const;

const REGISTRY_ABI = [
  "function syncPassWithTxProof(address wallet, tuple(uint8 tier,uint8 subTier,bytes2 group,bytes2 subGroup,uint256 countryBitmap,uint64 expiry,bool frozen,bool active,bytes32 customerIdHash,string kycSource) r, uint64 headerNumber, bytes txBytes, bytes32 merkleRoot, bytes32[] siblings, bytes32 lowerDigest, bytes32[] roots) external",
] as const;

export const handler: Schema["attestPass"]["functionHandler"] = async (event) => {
  console.log("[attestPass] invoke", JSON.stringify((event as unknown as { arguments: unknown }).arguments));
  try {
    const { userProfileId } = event.arguments as { userProfileId: string };
    console.log("[attestPass] args", userProfileId);
    if (!userProfileId) throw new Error("userProfileId required");

    console.log("[attestPass] get UserProfile", userProfileId);
    const { data: profile } = await client.models.UserProfile.get({ id: userProfileId });
    if (!profile) throw new Error("UserProfile not found");
    console.log("[attestPass] profile wallet", (profile as unknown as { walletAddress: string }).walletAddress);

    const pid = userProfileId;
    console.log("[attestPass] list PassRequest", pid);
    const { data: rowsRaw } = (await client.models.PassRequest.list({ filter: { userProfileId: { eq: pid } } })) as unknown as { data: { id: string; txHash: string; blockNumber: number; status: string }[] };
    console.log("[attestPass] rowsRaw len", rowsRaw?.length, JSON.stringify(rowsRaw)?.slice(0, 600));
    const rows = rowsRaw ? (JSON.parse(JSON.stringify(rowsRaw)) as typeof rowsRaw) : [];
    const reqRaw = (rows as unknown as { id: string; txHash: string; blockNumber: number; status: string }[])[0];
    if (!reqRaw) throw new Error("PassRequest not found");
    const req = JSON.parse(JSON.stringify(reqRaw)) as typeof reqRaw;
    console.log("[attestPass] req", req);
    if (req.status === "active") return JSON.stringify({ status: "active", txHash: req.txHash });

    const walletAddress = (profile as unknown as { walletAddress: string }).walletAddress;

    console.log("[attestPass] providers");
    const sepolia = new ethers.JsonRpcProvider(env.SEPOLIA_RPC_URL as string);
    const cc = new ethers.JsonRpcProvider(env.CREDITCOIN_RPC_URL as string);

    console.log("[attestPass] getRecord", walletAddress);
    const hub = new ethers.Contract(env.GOPASS_ADDR as string, GOPASS_ABI, sepolia);
    const record = await (hub as unknown as { getRecord: (a: string) => Promise<unknown> }).getRecord(walletAddress);
    console.log("[attestPass] record ok");

    const txHash = req.txHash;
    console.log("[attestPass] ProofBuilder", txHash);
    const builder = new proofProvider.service.ProofBuilder(1, env.PROOF_BUILDER_URL as string);

    const tx = await sepolia.getTransaction(txHash);
    console.log("[attestPass] tx block", tx?.blockNumber);
    if (!tx?.blockNumber) throw new Error(`tx ${txHash} not found on Sepolia`);

    console.log("[attestPass] getProof");
    const res = await builder.getProof(txHash);
    console.log("[attestPass] getProof", JSON.stringify(res)?.slice(0, 1200));
    if (!res.success || !res.data) {
      const msg = String((res as unknown as { error: string }).error || "");
      if (msg.toLowerCase().includes("not yet attested") || msg.toLowerCase().includes("not yet") || msg.toLowerCase().includes("height")) {
        throw new Error(`not attested yet: ${msg}`);
      }
      throw new Error(`Proof generation failed: ${(res as unknown as { error: string }).error}`);
    }
    const rawDeep = JSON.parse(JSON.stringify(res.data)) as { headerNumber: number; chainKey: number; txBytes: string; merkleProof: { root: string; siblings: { hash: string; isLeft: boolean }[] }; continuityProof: { lowerEndpointDigest: string; roots: string[] } };
    const d = {
      headerNumber: rawDeep.headerNumber,
      chainKey: rawDeep.chainKey,
      txBytes: rawDeep.txBytes,
      merkleProof: { root: rawDeep.merkleProof.root, siblings: rawDeep.merkleProof.siblings.map((s) => ({ hash: String(s.hash), isLeft: Boolean(s.isLeft) })) },
      continuityProof: { lowerEndpointDigest: rawDeep.continuityProof.lowerEndpointDigest, roots: [...rawDeep.continuityProof.roots.map(String)] },
    };
    console.log("[attestPass] header", d.headerNumber, "siblings", d.merkleProof.siblings.length);

    console.log("[attestPass] verifySingle");
    const prover = new blockProver.PrecompileBlockProver(cc);
    const ok = await prover.verifySingle(d.chainKey, d.headerNumber, d.txBytes, d.merkleProof, d.continuityProof);
    console.log("[attestPass] verify", ok);
    if (!ok) throw new Error("verifySingle failed");

    const pk = env.OWNER_PK as string;
    if (!pk) throw new Error("OWNER_PK not set");

    console.log("[attestPass] sync registry");
    const owner = new ethers.Wallet(pk, cc);
    const registry = new ethers.Contract(env.GOPASS_REGISTRY_ADDR as string, REGISTRY_ABI, owner);
    const tx1 = await (registry as unknown as { syncPassWithTxProof: (...a: unknown[]) => Promise<ethers.TransactionResponse> }).syncPassWithTxProof(
      walletAddress,
      record,
      d.headerNumber,
      d.txBytes,
      d.merkleProof.root,
      d.merkleProof.siblings.map((s) => s.hash),
      d.continuityProof.lowerEndpointDigest,
      d.continuityProof.roots
    );
    console.log("[attestPass] sync hash", tx1.hash);
    await tx1.wait();
    console.log("[attestPass] sync mined");

    console.log("[attestPass] setActive");
    const gopassOwner = new ethers.Contract(env.GOPASS_ADDR as string, GOPASS_ABI, new ethers.Wallet(pk, sepolia));
    const tx2 = await (gopassOwner as unknown as { setActive: (a: string, b: boolean) => Promise<ethers.TransactionResponse> }).setActive(walletAddress, true);
    console.log("[attestPass] active hash", tx2.hash);
    await tx2.wait();
    console.log("[attestPass] active mined");

    console.log("[attestPass] update PassRequest", req.id);
    await client.models.PassRequest.update({ id: String(req.id), status: "active" } as unknown as { id: string; status: "active" });
    console.log("[attestPass] updated");

    return JSON.stringify({ status: "active", txHash });
  } catch (e) {
    console.error("[attestPass] error", e, (e as Error)?.stack);
    throw e;
  }
};
