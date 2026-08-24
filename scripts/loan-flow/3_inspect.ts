import 'dotenv/config';
import { Contract, ethers } from 'ethers';

const abi = ['function getAdvanceOrder(uint256) view returns (tuple(tuple(address from, address to, address withToken) fundFlow, tuple(address from, address to, address withToken) repayFlow, tuple(uint256 loanAmount, uint256 interestRate, uint256 expectedRepaymentAmount, uint256 deadlineBlockNumber, uint256 collateralStreamId) terms, bytes sigLender, bytes sigBorrower, uint256 createdAtBlock, uint8 status, uint256 repaidAmount))'] as const;

async function main() {
  const [idArg] = process.argv.slice(2);
  if (!idArg) { console.error('Usage: npx tsx scripts/advance/3_inspect.ts <advanceId>'); process.exit(1); }
  const id = Number(idArg);
  const rpc = process.env.CREDITCOIN_RPC_URL!;
  const managerAddr = process.env.ADVANCE_MANAGER_ADDRESS!;
  const provider = new ethers.JsonRpcProvider(rpc);
  const manager = new Contract(managerAddr, abi as any, provider);
  const order: any = await (manager as any).getAdvanceOrder(id);
  console.log('Advance', id, JSON.stringify(order, (k,v)=> typeof v==='bigint'? v.toString(): v, 2));
}
main().catch(e=>{console.error(e);process.exit(1);});
