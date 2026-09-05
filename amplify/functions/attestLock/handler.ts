import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/attestLock";
import { ethers } from "ethers";
import { proofProvider, blockProver } from "@gluwa/usc-sdk";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

const SOURCE_ABI = [
  "event Locked(bytes32 indexed lockId, address indexed recipient, address indexed collateralToken, uint256 amount, bytes32 marketId, uint64 nonce)",
  "function locks(bytes32) view returns (address recipient, address collateralToken, uint256 amount, bytes32 marketId)",
] as const;

const CORE_ABI = [
  "function verifyAndSupplyCollateral(tuple(bytes32 lockId, address sourceCollateral, uint256 amount, address recipient, bytes32 marketId, uint64 headerNumber, bytes txBytes, bytes32 merkleRoot, bytes32[] siblings, bytes32 lowerDigest, bytes32[] roots) p, tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) mp) external",
  "function isProofUsed(bytes32) view returns (bool)",
  "function position(bytes32, address) view returns (tuple(uint256 supplyShares, uint128 collateral, uint256 borrowShares))",
] as const;

type LockRecord = {
  id: string;
  ownerWallet: string;
  marketSlug: string;
  lockTxHash: string;
  blockNumber: number;
  lockId: string;
  amount: string;
  nonce: number;
  status: string;
  attestTxHash?: string | null;
};

function marketParamsFor(slug: string) {
  const isNikkei = slug === "nikkei";
  return {
    loanToken: (isNikkei ? env.CUSDT_CC : env.ATC_CC) as string,
    collateralToken: (isNikkei ? env.GTOKEN_AN225 : env.GTOKEN_ATBILL) as string,
    oracle: (isNikkei ? env.ORACLE_AN225 : env.ORACLE_ATBILL) as string,
    irm: env.IRM_ADDR as string,
    lltv: BigInt(env.LLTV as string),
  };
}

export const handler: Schema["attestLock"]["functionHandler"] = async (event) => {
  console.log("[attestLock] invoke", JSON.stringify((event as unknown as { arguments: unknown }).arguments));
  const { lockTxHash, marketSlug } = event.arguments as { lockTxHash: string; marketSlug: string };
  if (!lockTxHash || !marketSlug) throw new Error("lockTxHash and marketSlug required");

  const { data: recs } = (await (client.models.LockRecord as unknown as {
    list: (a: { filter: unknown }) => Promise<{ data: LockRecord[] }>;
  }).list({ filter: { lockTxHash: { eq: lockTxHash } } })) as unknown as { data: LockRecord[] };
  const rec = recs?.[0];
  if (!rec) throw new Error("LockRecord not found — lock on Sepolia first");
  if (rec.status === "attested") return JSON.stringify({ status: "attested", txHash: rec.attestTxHash, lockId: rec.lockId });

  const recipient = rec.ownerWallet;
  const mp = marketParamsFor(marketSlug);
  const marketId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "address", "address", "uint256"],
      [mp.loanToken, mp.collateralToken, mp.oracle, mp.irm, mp.lltv]
    )
  );

  const cc = new ethers.JsonRpcProvider(env.CREDITCOIN_RPC_URL as string);
  const sepolia = new ethers.JsonRpcProvider(env.SEPOLIA_RPC_URL as string);

  // pull the lock details from the source chain receipt (single source of truth)
  const vault = new ethers.Contract(env.SOURCE_VAULT_ADDR as string, SOURCE_ABI, sepolia);
  const rc = await sepolia.getTransactionReceipt(lockTxHash);
  if (!rc || rc.status !== 1) throw new Error("lock tx not mined or failed");
  const lockLog = rc.logs.find((l) => l.address.toLowerCase() === (env.SOURCE_VAULT_ADDR as string).toLowerCase());
  if (!lockLog) throw new Error("Locked log not found in receipt");
  const parsed = vault.interface.parseLog({ topics: [...lockLog.topics], data: lockLog.data });
  if (!parsed) throw new Error("could not parse Locked log");
  const amount = parsed.args.amount as bigint;
  const sourceCollateral = parsed.args.collateralToken as string;
  const lockId = parsed.args.lockId as string;
  const lockBlock = rc.blockNumber;

  // already consumed? (idempotent — someone else submitted the proof)
  const core = new ethers.Contract(env.CORE_VAULT_ADDR as string, CORE_ABI, cc);
  const used = await (core as unknown as { isProofUsed: (a: string) => Promise<boolean> }).isProofUsed(lockId);
  if (used) {
    await client.models.LockRecord.update({ id: rec.id, status: "attested" });
    return JSON.stringify({ status: "attested", lockId, alreadyUsed: true });
  }

  const builder = new proofProvider.service.ProofBuilder(1, env.PROOF_BUILDER_URL as string, 5000);
  const res = await builder.getProof(lockTxHash);
  if (!res.success || !res.data) {
    const rawErr = String((res as unknown as { error: string }).error || "");
    const pending = rawErr.includes("404") || rawErr.toLowerCase().includes("not yet attested") || rawErr.toLowerCase().includes("not yet");
    console.warn("[attestLock] proof not ready", rawErr);
    if (pending) return JSON.stringify({ status: "pending", lockTxHash, reason: rawErr.slice(0, 300), blockNumber: lockBlock });
    throw new Error(`Proof generation failed: ${rawErr}`);
  }
  const d = res.data as any;
  console.log("[attestLock] proof header", d.headerNumber, "siblings", d.merkleProof.siblings.length);

  const prover = new blockProver.PrecompileBlockProver(cc);
  const ok = await prover.verifySingle(d.chainKey ?? 1, d.headerNumber, d.txBytes, d.merkleProof, d.continuityProof);
  if (!ok) throw new Error("off-chain verifySingle failed");

  const proof = {
    lockId,
    sourceCollateral,
    amount,
    recipient,
    marketId,
    headerNumber: d.headerNumber,
    txBytes: d.txBytes,
    merkleRoot: d.merkleProof.root,
    siblings: d.merkleProof.siblings.map((s: any) => s.hash ?? s),
    lowerDigest: d.continuityProof.lowerEndpointDigest,
    roots: d.continuityProof.roots,
  };

  await client.models.LockRecord.update({ id: rec.id, status: "attesting" });

  const pk = env.OWNER_PK as string;
  const owner = new ethers.Wallet(pk, cc);
  const coreSigner = new ethers.Contract(env.CORE_VAULT_ADDR as string, CORE_ABI, owner);
  const tx = await (coreSigner as any).verifyAndSupplyCollateral(proof, mp);
  console.log("[attestLock] verifyAndSupplyCollateral", tx.hash);
  try {
    await tx.wait(1, 120000);
  } catch (e) {
    console.warn("[attestLock] wait timeout/err", e);
  }

  await client.models.LockRecord.update({
    id: rec.id,
    status: "attested",
    attestTxHash: tx.hash,
  });

  return JSON.stringify({ status: "attested", lockId, txHash: tx.hash });
};
