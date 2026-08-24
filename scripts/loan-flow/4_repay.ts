import 'dotenv/config';
import { Contract, ethers } from 'ethers';

const auxAbi = ['function repayAdvance(uint256 advanceId, uint256 amount, address from, address to, address token) external'] as const;
const erc20Abi = ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) external returns (bool)'] as const;

async function main() {
  const [idArg, amtArg] = process.argv.slice(2);
  if (!idArg || !amtArg) { console.error('Usage: npx tsx scripts/advance/4_repay.ts <advanceId> <amount>'); process.exit(1); }
  const id = Number(idArg), amount = Number(amtArg);
  const srcRpc = process.env.SOURCE_CHAIN_RPC_URL!;
  const lenderKey = process.env.LENDER_WALLET_PRIVATE_KEY!;
  const borrowerKey = process.env.BORROWER_WALLET_PRIVATE_KEY!;
  const auxAddr = process.env.AUXILIARY_ADVANCE_ADDRESS!;
  const tokenAddr = process.env.SOURCE_CHAIN_ERC20_CONTRACT_ADDRESS!;
  const lenderWallet = new ethers.Wallet(lenderKey, new ethers.JsonRpcProvider(srcRpc));
  const borrowerWallet = new ethers.Wallet(borrowerKey, new ethers.JsonRpcProvider(srcRpc));
  const aux = new Contract(auxAddr, auxAbi as any, borrowerWallet);
  const token = new Contract(tokenAddr, erc20Abi as any, borrowerWallet);
  const allowance: bigint = await (token as any).allowance(borrowerWallet.address, auxAddr);
  if (allowance < BigInt(amount)) {
    console.log(`Approving ${amount}...`);
    const tx = await (token as any).approve(auxAddr, amount);
    console.log('approve', tx.hash); await tx.wait();
  }
  const tx = await (aux as any).repayAdvance(id, amount, borrowerWallet.address, lenderWallet.address, tokenAddr);
  console.log('repay tx', tx.hash); await tx.wait(); console.log('repaid');
}
main().catch(e=>{console.error(e);process.exit(1);});
