import 'dotenv/config';
import { Contract, ethers } from 'ethers';

const abi = ['function registerSourceAdvanceContract(address) external', 'function sourceAdvanceContract() view returns (address)'] as const;

async function main() {
  const [auxAddr] = process.argv.slice(2);
  const addr = auxAddr || process.env.AUXILIARY_ADVANCE_ADDRESS!;
  if (!addr) throw new Error('AUXILIARY_ADVANCE_ADDRESS missing');
  const rpc = process.env.CREDITCOIN_RPC_URL!;
  const pk = process.env.CREDITCOIN_WALLET_PRIVATE_KEY!;
  const managerAddr = process.env.ADVANCE_MANAGER_ADDRESS || process.env.USC_LOAN_MANAGER_CONTRACT_ADDRESS!;
  if (!rpc || !pk || !managerAddr) throw new Error('CREDITCOIN_RPC_URL / PRIVATE_KEY / ADVANCE_MANAGER_ADDRESS missing');
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(pk, provider);
  const manager = new Contract(managerAddr, abi as any, wallet);
  const tx = await (manager as any).registerSourceAdvanceContract(addr);
  console.log('Registering', addr, 'tx', tx.hash);
  await tx.wait();
  console.log('registered, sourceAdvanceContract=', await (manager as any).sourceAdvanceContract());
}
main().catch(e => { console.error(e); process.exit(1); });
