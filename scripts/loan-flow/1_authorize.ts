import 'dotenv/config';
import { Contract, ethers } from 'ethers';

const abi = ['function addAuthorizedToken(address token) external'] as const;

async function main() {
  const [token] = process.argv.slice(2);
  if (!token || !token.startsWith('0x')) {
    console.error('Usage: npx tsx scripts/advance/1_authorize.ts 0xKKUB');
    process.exit(1);
  }
  const rpc = process.env.SOURCE_CHAIN_RPC_URL!;
  const pk = process.env.CREDITCOIN_WALLET_PRIVATE_KEY!;
  const auxAddr = process.env.AUXILIARY_ADVANCE_ADDRESS || process.env.SOURCE_CHAIN_LOAN_CONTRACT_ADDRESS!;
  if (!rpc || !pk || !auxAddr) throw new Error('SOURCE_CHAIN_RPC_URL / PRIVATE_KEY / AUXILIARY_ADVANCE_ADDRESS missing');
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const aux = new Contract(auxAddr, abi as any, wallet);
  const tx = await (aux as any).addAuthorizedToken(token);
  console.log('Token authorized', token, 'tx', tx.hash);
  await tx.wait();
  console.log('done');
}
main().catch(e => { console.error(e); process.exit(1); });
