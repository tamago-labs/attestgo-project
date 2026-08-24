/**
 * 3_deploy_atteststream.ts — Deploy AttestStream to Sepolia + quick checks
 *
 * Deploys contracts/src/AttestStream.sol (ERC20 0.8.19, OZ v4.9.6) to Sepolia,
 * prints address + tx hash, verifies on-chain (code, name, symbol, balance).
 * Writes hint to update .env.
 *
 * Requires: forge build has been run (out/AttestStream.sol/AttestStream.json exists)
 *           SOURCE_CHAIN_RPC_URL + CREDITCOIN_WALLET_PRIVATE_KEY (same key for deploy)
 *           Sepolia ETH for gas (faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
 *
 * Usage:
 *   forge build --root contracts
 *   npx tsx scripts/3_deploy_atteststream.ts
 *   npx tsx scripts/3_deploy_atteststream.ts --verify-only 0x<AttestStreamAddr>
 *   npx tsx scripts/3_deploy_atteststream.ts --check 0x<AttestStreamAddr>
 */

import 'dotenv/config';
import { JsonRpcProvider, Wallet, Contract, ContractFactory, InterfaceAbi } from 'ethers';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SRC_RPC = process.env.SOURCE_CHAIN_RPC_URL || '';
const PK = process.env.CREDITCOIN_WALLET_PRIVATE_KEY || '';
const VERIFY_ONLY = process.argv.includes('--verify-only');
const CHECK_ONLY = process.argv.includes('--check');
const targetArg = process.argv[process.argv.findIndex((a) => a === '--verify-only' || a === '--check') + 1] as string | undefined;

if (!SRC_RPC) {
  console.error('❌ SOURCE_CHAIN_RPC_URL missing in .env (e.g. https://sepolia.infura.io/v3/<key>)');
  process.exit(1);
}
if (!PK || !PK.startsWith('0x')) {
  console.error('❌ CREDITCOIN_WALLET_PRIVATE_KEY missing (0x...) — deployer/payer');
  process.exit(1);
}

function loadArtifact(): { abi: InterfaceAbi; bytecode: string } {
  const candidates = [
    join(process.cwd(), 'contracts', 'out', 'AttestStream.sol', 'AttestStream.json'),
    join(process.cwd(), 'out', 'AttestStream.sol', 'AttestStream.json'),
    join(process.cwd(), 'contracts', 'out', 'AttestStream.sol', 'AttestStream.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const j = JSON.parse(readFileSync(p, 'utf8'));
      const abi = j.abi as InterfaceAbi;
      const bytecode = (j.bytecode?.object as string) || (j.bytecode as string) || j.deployedBytecode;
      // forge artifact: bytecode.object is hex without 0x
      const bc = bytecode?.startsWith('0x') ? bytecode : `0x${bytecode}`;
      if (abi && bc && bc !== '0x') return { abi, bytecode: bc };
    }
  }
  console.error(`
❌ AttestStream artifact not found.

Run:
  forge build --root contracts
  # or
  npx --prefix contracts forge build

Expected: contracts/out/AttestStream.sol/AttestStream.json
`);
  process.exit(1);
}

async function checkContract(addr: string, provider: JsonRpcProvider) {
  console.log(`\n🔍 Checking ${addr} on Sepolia...`);
  const code = await provider.getCode(addr);
  console.log(`  code length: ${(code.length - 2) / 2} bytes ${code === '0x' ? '❌ empty' : '✅ deployed'}`);
  if (code === '0x') throw new Error('No code at address — not deployed or wrong network');

  const abi = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function getStreamPaymentEventSignature() view returns (bytes32)',
  ] as const;
  const c = new Contract(addr, abi as unknown as InterfaceAbi, provider);
  const [name, symbol, decimals, supply, sig] = await Promise.all([
    c.name(),
    c.symbol(),
    c.decimals(),
    c.totalSupply(),
    c.getStreamPaymentEventSignature(),
  ]);
  console.log(`  name=${name} symbol=${symbol} decimals=${decimals} totalSupply=${supply.toString()}`);
  console.log(`  StreamPayment sig=${sig}`);
  console.log(`  explorer: https://sepolia.etherscan.io/address/${addr}`);
  return { name, symbol, decimals, supply };
}

async function main() {
  const provider = new JsonRpcProvider(SRC_RPC);
  const wallet = new Wallet(PK, provider);
  const network = await provider.getNetwork().catch(() => ({ chainId: 0n, name: 'unknown' } as any));
  console.log(`\n🔗 Sepolia RPC: ${SRC_RPC.slice(0, 48)}... chainId=${network.chainId}`);
  console.log(`👛 Deployer: ${wallet.address}`);
  const bal = await provider.getBalance(wallet.address);
  console.log(`💰 Sepolia ETH: ${bal.toString()} wei (${Number(bal) / 1e18} ETH)`);
  if (bal === 0n) console.warn('⚠️  No Sepolia ETH — fund via https://cloud.google.com/application/web3/faucet/ethereum/sepolia');

  if (VERIFY_ONLY || CHECK_ONLY) {
    const addr = targetArg;
    if (!addr || !addr.startsWith('0x') || addr.length !== 42) {
      console.error('Usage: npx tsx scripts/3_deploy_atteststream.ts --check 0x<addr>');
      process.exit(1);
    }
    await checkContract(addr, provider);
    return;
  }

  console.log('\n⏳ Loading artifact contracts/out/AttestStream.sol/AttestStream.json...');
  const { abi, bytecode } = loadArtifact();
  console.log(`  abi entries=${(abi as any).length} bytecode=${bytecode.length / 2} bytes`);

  console.log('\n🚀 Deploying AttestStream (1_000_000 ASTR) ...');
  const factory = new ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  console.log(`  tx hash: ${contract.deploymentTransaction()?.hash}`);
  console.log('  waiting for mining...');
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  const receipt = await provider.getTransactionReceipt(contract.deploymentTransaction()!.hash!);
  console.log(`\n✅ Deployed AttestStream to ${addr}`);
  console.log(`   tx: ${contract.deploymentTransaction()?.hash} block: ${receipt?.blockNumber} gasUsed: ${receipt?.gasUsed?.toString()}`);

  await checkContract(addr, provider);
  const c = new Contract(addr, abi, provider);
  const deployerBal = await (c as any).balanceOf(wallet.address);
  console.log(`  deployer ASTR balance: ${deployerBal.toString()} (1M = 1000000000000000000000000)`);

  console.log('\n📝 Update .env:');
  console.log(`  SOURCE_CHAIN_CONTRACT_ADDRESS=${addr}`);
  console.log(`  SOURCE_CHAIN_CUSTOM_CONTRACT_ADDRESS=${addr}`);
  console.log('\nNext:');
  console.log(`  npx tsx scripts/3_deploy_atteststream.ts --check ${addr}`);
  console.log(`  cast send --rpc-url $SOURCE_CHAIN_RPC_URL ${addr} "payStream(address,uint256,bytes32,uint256,string)" <recipient> 1000000000000000000 0x$(echo -n "attest-1" | cast keccak) 1 "salary" --private-key $CREDITCOIN_WALLET_PRIVATE_KEY`);
  console.log(`  npx tsx scripts/2_verify_single_view.ts <txHashFromAbove>`);
  console.log(`  npx tsx scripts/5_worker.ts  # auto relay StreamPayment -> Creditcoin 0x2Be9...`);
  console.log('');
}

main().catch((e) => {
  console.error('❌', e.message ?? e);
  process.exit(1);
});
