/**
 * 5_fix_tbill_oracle.ts — diagnose + fix the tbill oracle price so borrow math works
 * Usage: npx tsx scripts/lending/5_fix_tbill_oracle.ts --check
 *        npx tsx scripts/lending/5_fix_tbill_oracle.ts --fix
 */
import 'dotenv/config';
import { ethers } from 'ethers';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';
const ORACLE_ATBILL = process.env.ORACLE_ATBILL || '0xc1D218017533dA1F61ba28125bcCcEC0FB3874B2';
const PK = process.env.PRIVATE_KEY || '';

const ORACLE_ABI = [
  'function getPriceInfo() view returns (uint8 collMode, uint8 lnMode, uint256 collUsd, uint256 lnUsd, uint256 morphoPrice)',
  'function price() view returns (uint256)',
  'function owner() view returns (address)',
  'function whitelist(address) view returns (bool)',
  'function setPrice(uint256 newCollateralUsdPrice, uint256 newLoanUsdPrice) external',
] as const;

function arg(k: string) { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; }

async function main() {
  const fix = !!arg('--fix');
  const p = new ethers.JsonRpcProvider(CC_RPC);
  const oracle = new ethers.Contract(ORACLE_ATBILL, ORACLE_ABI, p);

  const [info, owner] = await Promise.all([
    oracle.getPriceInfo() as Promise<any>,
    oracle.owner() as Promise<string>,
  ]);

  console.log(`\nOracle: ${ORACLE_ATBILL}`);
  console.log(`owner: ${owner}`);
  console.log(`collateralOracleMode: ${info.collMode}`);
  console.log(`loanOracleMode: ${info.lnMode}`);
  console.log(`collateralUsdPrice: ${info.collUsd.toString()} (${ethers.formatUnits(info.collUsd, 18)})`);
  console.log(`loanUsdPrice:       ${info.lnUsd.toString()} (${ethers.formatUnits(info.lnUsd, 18)})`);
  console.log(`morpho price():     ${info.morphoPrice.toString()}`);

  // expected for ATC/aTBILL (both 18 dec): priceScale = 10^36, target price = (1e18 * 10^36) / 0.15e18 = 6.67e36
  const targetPrice = 6666666666666666666666666666666666666n; // ~6.67e36
  console.log(`\ntarget price (~$1 aTBILL / $0.15 ATC): ${targetPrice.toString()}`);
  console.log(`current  ${(Number(info.morphoPrice) / 1e36).toFixed(4)}e36  vs  target ${(Number(targetPrice) / 1e36).toFixed(4)}e36`);

  if (!fix) {
    console.log(`\nRun with --fix to setPrice(1e18, 0.15e18)`);
    return;
  }

  if (!PK) throw new Error('PRIVATE_KEY required to fix');
  const w = new ethers.Wallet(PK, p);
  const wl = await oracle.whitelist(w.address) as boolean;
  console.log(`\ncaller ${w.address} whitelisted: ${wl}`);
  if (!wl) throw new Error('caller not whitelisted — cannot setPrice');

  const collUsd = 1000000000000000000n; // $1.00 (18 dec)
  const loanUsd = 150000000000000000n;  // $0.15 (18 dec)
  console.log(`setting price: collUsd=${collUsd.toString()} loanUsd=${loanUsd.toString()}...`);
  const tx = await (oracle.connect(w) as any).setPrice(collUsd, loanUsd);
  console.log(`tx ${tx.hash}...`);
  await tx.wait();
  console.log('confirmed');

  const newPrice = await oracle.price() as bigint;
  console.log(`\nnew price(): ${newPrice.toString()} (${(Number(newPrice) / 1e36).toFixed(4)}e36)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
