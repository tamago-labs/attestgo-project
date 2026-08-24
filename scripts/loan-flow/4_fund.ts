import 'dotenv/config';
import { Contract, ethers } from 'ethers';

const auxAbi = ['function fundAdvance(uint256 advanceId, uint256 amount, address from, address to, address token) external'] as const;
const erc20Abi = ['function balanceOf(address) view returns (uint256)', 'function allowance(address,address) view returns (uint256)', 'function approve(address,uint256) external returns (bool)'] as const;

async function main() {
  const [idArg, amtArg] = process.argv.slice(2);
  if (!idArg || !amtArg) { console.error('Usage: npx tsx scripts/advance/4_fund.ts <advanceId> <amount>  # amount human "10" or wei "10000000000000000000"'); process.exit(1); }
  const id = Number(idArg);
  const amount: bigint = amtArg.includes('.') || amtArg.length > 15 ? (amtArg.includes('.') ? ethers.parseUnits(amtArg, 18) : BigInt(amtArg)) : ethers.parseUnits(amtArg, 18);
  const srcRpc = process.env.SOURCE_CHAIN_RPC_URL!;
  const lenderKey = process.env.LENDER_WALLET_PRIVATE_KEY!;
  const borrowerKey = process.env.BORROWER_WALLET_PRIVATE_KEY!;
  const auxAddr = process.env.AUXILIARY_ADVANCE_ADDRESS!;
  const tokenAddr = process.env.SOURCE_CHAIN_ERC20_CONTRACT_ADDRESS!;
  const lenderWallet = new ethers.Wallet(lenderKey, new ethers.JsonRpcProvider(srcRpc));
  const borrowerWallet = new ethers.Wallet(borrowerKey, new ethers.JsonRpcProvider(srcRpc));
  const provider = new ethers.JsonRpcProvider(srcRpc);
  const aux = new Contract(auxAddr, auxAbi as any, lenderWallet);
  const token = new Contract(tokenAddr, erc20Abi as any, lenderWallet);
  const bal: bigint = await (token as any).balanceOf(lenderWallet.address);
  console.log(`Lender balance ${bal}, need ${amount.toString()}`);
  const allowance: bigint = await (token as any).allowance(lenderWallet.address, auxAddr);
  if (allowance < amount) {
    console.log(`Approving ${amount.toString()}...`);
    const tx = await (token as any).approve(auxAddr, amount);
    console.log('approve', tx.hash); await tx.wait();
  }
  const tx = await (aux as any).fundAdvance(id, amount, lenderWallet.address, borrowerWallet.address, tokenAddr);
  console.log('fund tx', tx.hash); await tx.wait(); console.log('funded');
}
main().catch(e=>{console.error(e);process.exit(1);});
