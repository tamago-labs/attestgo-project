/**
 * 1_check_chains.ts — verify CC3 + dest RPCs and GOPass contracts
 * Usage: npx tsx scripts/gopass/1_check_chains.ts
 * Env: CREDITCOIN_RPC_URL, SEPOLIA_RPC_URL, GOPASS_ADDR, VERIFIER_ADDR, GTOKEN_ADDR
 */

// PS C:\projects\attestgo-project> npx tsx scripts/gopass/1_check_chains.ts
// GO Pass chain check

// 🔗 Creditcoin: https://rpc.cc3-testnet.creditcoin.network...
//   chainId=102031 block=5370125

// ✅ CC3 supported chains (2):
//   key=3 id=1 name=0x457468657265756d
//   key=1 id=11155111 name=0x5365706f6c696120657468657265756d
//   GOPass 0x343B31905A1c9EdDA115027A14F8a4a1e0519cD5: no code

// 🔗 Sepolia: https://eth-sepolia.g.alchemy.com/v2/46BFnBkjDdWActWG5HvRV...
//   chainId=11155111 block=11562353
//   GToken 0xf194eec4e6EcA244BcA03b6A7cb91768084991DA: 13140 bytes
//     owner=0xB045bbB51f3CE266A506f332EDBDe176C9862Ff3

// Done.

import 'dotenv/config';
import { JsonRpcProvider, Contract } from 'ethers';
import { chainInfo } from '@gluwa/usc-sdk';

const CREDITCOIN_RPC_URL = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || process.env.SOURCE_CHAIN_RPC_URL || '';
const GOPASS_ADDR = process.env.GOPASS_ADDR || '';
const VERIFIER_ADDR = process.env.VERIFIER_ADDR || '';
const GTOKEN_ADDR = process.env.GTOKEN_ADDR || '';

async function check(label: string, url: string) {
  console.log(`\n🔗 ${label}: ${url.slice(0, 60)}...`);
  const p = new JsonRpcProvider(url);
  const net = await p.getNetwork();
  const block = await p.getBlockNumber();
  console.log(`  chainId=${net.chainId} block=${block}`);
  return p;
}

async function code(p: JsonRpcProvider, addr: string, name: string) {
  if (!addr) { console.log(`  ${name}: (not set)`); return; }
  const c = await p.getCode(addr);
  console.log(`  ${name} ${addr}: ${c === '0x' ? 'no code' : `${c.length} bytes`}`);
  if (c !== '0x') {
    try {
      const abi = ['function owner() view returns (address)', 'function hasPass(address) view returns (bool)', 'function recordHash(address) view returns (bytes32)'];
      const ct = new Contract(addr, abi, p);
      console.log(`    owner=${await ct.owner()}`);
    } catch {}
  }
}

async function main() {
  console.log('GO Pass chain check');
  const cc = await check('Creditcoin', CREDITCOIN_RPC_URL);
  const info = new chainInfo.PrecompileChainInfoProvider(cc);
  try {
    const chains = await info.getSupportedChains();
    console.log(`\n✅ CC3 supported chains (${chains.length}):`);
    for (const c of chains as any[]) console.log(`  key=${c.chainKey} id=${c.chainId} name=${c.chainName ?? 'n/a'}`);
  } catch (e: any) { console.warn('  chainInfo failed', e.message); }
  if (GOPASS_ADDR) await code(cc, GOPASS_ADDR, 'GOPass');
  if (SEPOLIA_RPC_URL) {
    const se = await check('Sepolia', SEPOLIA_RPC_URL);
    if (VERIFIER_ADDR) {
      await code(se, VERIFIER_ADDR, 'GOPassVerifier');
      try {
        const m = new Contract(VERIFIER_ADDR, ['function GOPASS_ADDR() view returns (address)', 'function worker() view returns (address)', 'function cacheTTL() view returns (uint64)'], se);
        console.log(`    GOPASS_ADDR=${await m.GOPASS_ADDR()} worker=${await m.worker()} ttl=${await m.cacheTTL()}`);
      } catch {}
    }
    if (GTOKEN_ADDR) await code(se, GTOKEN_ADDR, 'GToken');
  } else console.log('\n⚠️  SEPOLIA_RPC_URL not set — skip dest check');
  console.log('\nDone.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
