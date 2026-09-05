/**
 * 2c_prove_and_borrow.ts — wait attested, build proof via ProofBuilder, verify on CoreVault, then borrow
 * Mirrors scripts/gopass/3_worker_sync.ts flow (chainKey, txBytes, off-chain verifySingle before on-chain)
 * Usage: npx tsx scripts/lending/2c_prove_and_borrow.ts --market nikkei --lockTx 0x... --amount 10 --borrow 100
 *        npx tsx scripts/lending/2c_prove_and_borrow.ts --market nikkei --borrow-only --borrow 100   (collateral already credited)
 * Env: CREDITCOIN_RPC_URL, SEPOLIA_RPC_URL, PRIVATE_KEY, SOURCE_VAULT_ADDR, CORE_VAULT_ADDR, MORPHO_ADDR, CUSDT_CC, ATC_CC, GTOKEN_SOURCE_AN225, GTOKEN_SOURCE_ATBILL, ORACLE_AN225, ORACLE_ATBILL, IRM_ADDR, LLTV, PROOF_BUILDER_URL, SOURCE_CHAIN_KEY=1
 */
import 'dotenv/config';
import { Contract, JsonRpcProvider, Wallet, keccak256, AbiCoder, parseUnits } from 'ethers';
import { proofProvider, chainInfo, blockProver } from '@gluwa/usc-sdk';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const PK = process.env.PRIVATE_KEY || '';
const CORE = process.env.CORE_VAULT_ADDR || '0x51062701163469d30a0c4331BB2FBab215d24434';
const MORPHO = process.env.MORPHO_ADDR || '0x10FbF147BfaC591c1756C67b1eAfeaEB11b3E67D';
function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

const MARKETS: Record<string, { loanEnv: string; sourceEnv: string; oracleEnv: string; lltv: string; loanDec: number }> = {
  nikkei: { loanEnv: 'CUSDT_CC', sourceEnv: 'GTOKEN_SOURCE_AN225', oracleEnv: 'ORACLE_AN225', lltv: '620000000000000000', loanDec: 6 },
  tbill: { loanEnv: 'ATC_CC', sourceEnv: 'GTOKEN_SOURCE_ATBILL', oracleEnv: 'ORACLE_ATBILL', lltv: '620000000000000000', loanDec: 18 },
};
const DEFAULTS: Record<string, string> = {
  CUSDT_CC: '0x60f6456FBE5566e515E63219fC9c0dbb80015F8E',
  ATC_CC: '0x3f0e699Ad6F14324c93A23Cd57aef60Ffa09DA6a',
  GTOKEN_SOURCE_AN225: '0xc55D7821b6e0D8AC162e5b672aa9eA87A066B5a8',
  GTOKEN_SOURCE_ATBILL: '0x266F1BA9Cd984D8DC9cb7029A7c69e9d216283Db',
  ORACLE_AN225: '0x4865dc0C4A3B11CF6FB57Dec180577f4824bB082',
  ORACLE_ATBILL: '0xc1D218017533dA1F61ba28125bcCcEC0FB3874B2',
};
const PROVER_URL = process.env.PROOF_BUILDER_URL || 'https://prover.cc3-testnet.creditcoin.network';
const CHAIN_KEY = Number(process.env.SOURCE_CHAIN_KEY || 1);
const SOURCE_VAULT = process.env.SOURCE_VAULT_ADDR || '0xd81F1A1a63fB33989bF46432527A6F7E997cF6ED';

const CORE_ABI = ['function verifyAndSupplyCollateral(tuple(bytes32 lockId,address sourceCollateral,uint256 amount,address recipient,bytes32 marketId,uint64 headerNumber,bytes txBytes,bytes32 merkleRoot,bytes32[] siblings,bytes32 lowerDigest,bytes32[] roots) p, tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) mp) external', 'function borrow(tuple(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv) mp, uint256 assets, address receiver) returns (uint256,uint256)'] as const;
const MORPHO_ABI = ['function position(bytes32,address) view returns (tuple(uint256 supplyShares,uint128 borrowShares,uint128 collateral))', 'function isAuthorized(address,address) view returns (bool)', 'function setAuthorization(address,bool)'] as const;

async function main() {
  const key = (arg('--market') || 'nikkei').toLowerCase();
  const m = MARKETS[key]; if (!m) { console.error('unknown market'); process.exit(1); }
  const borrowOnly = !!arg('--borrow-only'); // collateral already credited; skip proof + supply
  const lockTx = arg('--lockTx') || arg('--tx') || ''; if (!lockTx && !borrowOnly) { console.error('need --lockTx 0x... from 2b (or --borrow-only)'); process.exit(1); }
  const amountRaw = arg('--amount') || '10';
  const borrowRaw = arg('--borrow') || '100';
  const irm = arg('--irm') || process.env.IRM_ADDR || '0x3345A6582669C00cA022d9200C083b3097B18DBb';
  const lltv = arg('--lltv') || process.env.LLTV || m.lltv;
  const loan = process.env[m.loanEnv] || DEFAULTS[m.loanEnv];
  const source = process.env[m.sourceEnv] || DEFAULTS[m.sourceEnv];
  const oracle = process.env[m.oracleEnv] || DEFAULTS[m.oracleEnv];
  const col = source;
  const amount = parseUnits(amountRaw, 18);
  const borrowAmt = parseUnits(borrowRaw, m.loanDec);
  const mp = { loanToken: loan, collateralToken: col, oracle, irm, lltv: BigInt(lltv) };
  const marketId = keccak256(AbiCoder.defaultAbiCoder().encode(['address','address','address','address','uint256'], [loan, col, oracle, irm, BigInt(lltv)]));

  const cc = new JsonRpcProvider(CC_RPC);
  const w = new Wallet(PK, cc);
  const sepolia = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL || '');

  let core: Contract | null = null;
  let morpho: Contract | null = null;
  if (!borrowOnly) {
  const rc = await sepolia.getTransactionReceipt(lockTx);
  if (!rc) { console.error('lockTx not found on Sepolia'); process.exit(1); }
  const lockBlock = rc.blockNumber;
  console.log(`lockTx ${lockTx} block ${lockBlock} market=${key} amount=${amountRaw}`);

  const builder = new proofProvider.service.ProofBuilder(CHAIN_KEY, PROVER_URL, 5000);
  const info = new chainInfo.PrecompileChainInfoProvider(cc);
  const latest = await info.getLatestAttestedHeightAndHash(CHAIN_KEY);
  console.log(`latest attested ${latest.height}, waiting for ${lockBlock}...`);
  await builder.waitUntilHeightAttested(CHAIN_KEY, lockBlock, 15_000, 1_200_000);
  console.log('attested, generating proof...');
  const res = await builder.getProof(lockTx);
  if (!res.success || !res.data) throw new Error(`proof failed: ${res.error}`);
  const d: any = res.data;
  console.log(`proof header=${d.headerNumber} chainKey=${d.chainKey ?? CHAIN_KEY} siblings=${d.merkleProof.siblings.length} roots=${d.continuityProof.roots.length} cached=${d.cached ?? ''}`);
  console.log(`proof keys dump=${JSON.stringify(d).slice(0,1800)}`);
  // encodedTransaction = SDK ABI-encoded (transaction, receipt) — pass AS-IS to the precompile
  // and CoreVault (same as scripts/gopass/3_worker_sync.ts:100). Do NOT rebuild or re-encode:
  // the 0x0FD2 precompile only accepts the ProofBuilder's canonical encoding.
  const rawTxBytesAny: any = d.txBytes ?? '';
  const { hexlify } = await import('ethers');
  const rawTxBytes: string = typeof rawTxBytesAny === 'string' ? rawTxBytesAny : (() => { try { return hexlify(rawTxBytesAny); } catch { return String(rawTxBytesAny); } })();
  console.log(`txBytes type=${typeof rawTxBytesAny} isArray=${Array.isArray(rawTxBytesAny)} len=${String(rawTxBytes).length} head=${String(rawTxBytes).slice(0,66)}`);

  // off-chain view verify (same as 3_worker_sync.ts:100) before spending gas
  const prover = new blockProver.PrecompileBlockProver(cc);
  const ok = await prover.verifySingle(d.chainKey ?? CHAIN_KEY, d.headerNumber, rawTxBytesAny, d.merkleProof, d.continuityProof);
  console.log(`off-chain verifySingle: ${ok ? '✅' : '❌'}`);
  if (!ok) throw new Error('off-chain verifySingle failed — proof not yet valid on CC3');

  let parsedLockId = d.lockId as string | undefined;
  try {
    const log = rc.logs.find((l: any) => l.address.toLowerCase() === SOURCE_VAULT.toLowerCase());
    if (log && log.topics[1]) parsedLockId = log.topics[1];
  } catch {}  if (!parsedLockId) parsedLockId = d.lockId || keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','address','address','uint256','bytes32','uint256'], [11155111, source, w.address, amount, marketId, 0]));
  const txBytesNorm: string = String(rawTxBytes).startsWith('0x') ? String(rawTxBytes) : '0x' + String(rawTxBytes);
  const proof = {
    lockId: parsedLockId,
    sourceCollateral: source,
    amount,
    recipient: w.address,
    marketId,
    headerNumber: d.headerNumber,
    txBytes: txBytesNorm,
    merkleRoot: d.merkleProof.root,
    siblings: d.merkleProof.siblings.map((s: any) => s.hash ?? s),
    lowerDigest: d.continuityProof.lowerEndpointDigest,
    roots: d.continuityProof.roots,
  };
  console.log(`submitting verifyAndSupplyCollateral lockId=${parsedLockId}...`);
  core = new Contract(CORE, CORE_ABI, w);
  const tx2 = await (core as any).verifyAndSupplyCollateral(proof, mp);
  console.log(`verifyAndSupplyCollateral tx ${tx2.hash}...`);
  await tx2.wait();
  } // end !borrowOnly

  if (!core) core = new Contract(CORE, CORE_ABI, w);
  morpho = new Contract(MORPHO, MORPHO_ABI, cc);
  const pos = await (morpho as any).position(marketId, w.address);
  console.log(`collateral credited: ${pos[2].toString()}`);

  // CoreVault borrows on the user's behalf (onBehalf = msg.sender) — Morpho needs a one-time
  // per-wallet authorization. Re-run after every CoreVault redeploy (new address).
  const authorized = await (morpho as any).isAuthorized(w.address, CORE);
  if (!authorized) {
    console.log(`authorizing CoreVault to borrow on behalf of ${w.address}...`);
    const morphoSigner = new Contract(MORPHO, MORPHO_ABI, w);
    const authTx = await (morphoSigner as any).setAuthorization(CORE, true);
    console.log(`setAuthorization tx ${authTx.hash}...`);
    await authTx.wait();
  }

  const tx3 = await (core as any).borrow(mp, borrowAmt, w.address);
  console.log(`borrow ${borrowRaw} tx ${tx3.hash}...`);
  await tx3.wait();
  console.log('borrow done');
}
main().catch(e => { console.error(e); process.exit(1); });
