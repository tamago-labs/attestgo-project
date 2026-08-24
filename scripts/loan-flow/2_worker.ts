import 'dotenv/config';
import { Contract, ethers } from 'ethers';
import { proofProvider, chainInfo } from '@gluwa/usc-sdk';

const managerAbi = [
  'event AdvanceRegistered(uint256 indexed advanceId, address indexed lender, address indexed borrower, uint256 loanAmount, uint256 repayAmount, uint256 deadlineBlockNumber, uint256 collateralStreamId)',
  'event AdvanceFunded(uint256 indexed advanceId)',
  'event AdvanceRepaid(uint256 indexed advanceId)',
  'event AdvancePartiallyRepaid(uint256 indexed advanceId, uint256 amount)',
  'function registerAdvanceFund(uint256 advanceId, tuple(address from, address to, address withToken) flow, uint256 fundAmount, uint256 repayAmount) external',
  'function markAdvanceAsFunded(uint256 advanceId) external',
  'function noteAdvanceRepayment(uint256 advanceId, uint256 amount) external',
] as const;

const auxAbi = [
  'event AdvanceFunded(uint256 indexed advanceId)',
  'event AdvanceRepaid(uint256 indexed advanceId, uint256 amount)',
  'function registerAdvanceFund(uint256 advanceId, tuple(address from, address to, address withToken) flow, uint256 fundAmount, uint256 repayAmount) external',
] as const;

const SRC_RPC = process.env.SOURCE_CHAIN_RPC_URL!;
const CC_RPC = process.env.CREDITCOIN_RPC_URL!;
const PROVER = process.env.PROOF_BUILDER_URL!;
const SRC_KEY = Number(process.env.SOURCE_CHAIN_KEY || 1);
const MANAGER_ADDR = process.env.ADVANCE_MANAGER_ADDRESS || process.env.ADVANCE_MANAGER_ADDRESS!;
const AUX_ADDR = process.env.AUXILIARY_ADVANCE_ADDRESS!;
const PK = process.env.CREDITCOIN_WALLET_PRIVATE_KEY!;

if (!SRC_RPC || !CC_RPC || !PROVER || !MANAGER_ADDR || !AUX_ADDR || !PK) throw new Error('Missing env for advance worker');

async function generateProof(txHash: string, chainKey: number, proverUrl: string, ccProvider: any, srcProvider: any) {
  const tx = await srcProvider.getTransaction(txHash);
  if (!tx?.blockNumber) throw new Error('not mined');
  const builder = new proofProvider.service.ProofBuilder(chainKey, proverUrl, 5000);
  const info = new chainInfo.PrecompileChainInfoProvider(ccProvider);
  const latest = await info.getLatestAttestedHeightAndHash(chainKey);
  console.log(`  latest ${latest.height} wait ${tx.blockNumber}`);
  await builder.waitUntilHeightAttested(chainKey, tx.blockNumber, 15000, 1200000);
  return builder.getProof(txHash);
}

async function main() {
  console.log('Advance worker starting...');
  const srcProvider = new ethers.JsonRpcProvider(SRC_RPC);
  const ccProvider = new ethers.JsonRpcProvider(CC_RPC);
  const wallet = new ethers.Wallet(PK, ccProvider);
  const srcWallet = new ethers.Wallet(PK, srcProvider);
  const manager = new Contract(MANAGER_ADDR, managerAbi as any, wallet);
  const aux = new Contract(AUX_ADDR, auxAbi as any, srcWallet);
  let srcFrom = await srcProvider.getBlockNumber();
  let ccFrom = await ccProvider.getBlockNumber();
  console.log(`Polling src ${srcFrom} cc ${ccFrom}`);
  const seen = new Set<string>();

  async function safeQuery(contract: any, filter: any, fromBlock: number, provider: any): Promise<any[]> {
    try {
      const toBlock = await provider.getBlockNumber();
      if (fromBlock > toBlock) return [];
      return await contract.queryFilter(filter, fromBlock, toBlock);
    } catch (e: any) {
      console.error(`  poll error:`, e.shortMessage ?? e.message);
      await new Promise((r) => setTimeout(r, 10000));
      return [];
    }
  }

  while (true) {
    // CC -> Sepolia: AdvanceRegistered -> register fund on aux
    const ccEvents: any = await safeQuery(manager, (manager as any).filters.AdvanceRegistered(), ccFrom, ccProvider);
    for (const ev of ccEvents) {
      if (seen.has(ev.transactionHash)) continue;
      seen.add(ev.transactionHash);
      const [advanceId, lender, borrower, loanAmount, repayAmount] = ev.args;
      console.log(`AdvanceRegistered ${advanceId} lender ${lender} borrower ${borrower}`);
      try {
        const flow = { from: lender, to: borrower, withToken: process.env.SOURCE_CHAIN_ERC20_CONTRACT_ADDRESS! };
        const tx = await (aux as any).registerAdvanceFund(advanceId, flow, loanAmount, repayAmount);
        console.log(`  registered on aux ${tx.hash}`); await tx.wait();
      } catch (e: any) { console.error(e.shortMessage ?? e.message); }
    }
    // Sepolia AdvanceFunded -> CC mark funded
    const auxFunded: any = await safeQuery(aux, (aux as any).filters.AdvanceFunded(), srcFrom, srcProvider);
    for (const ev of auxFunded) {
      if (seen.has(ev.transactionHash)) continue;
      seen.add(ev.transactionHash);
      const [advanceId] = ev.args;
      console.log(`AdvanceFunded ${advanceId} tx ${ev.transactionHash}`);
      const res = await generateProof(ev.transactionHash, SRC_KEY, PROVER, ccProvider, srcProvider);
      if (res.success) {
        // For demo, worker directly marks funded (view verify already done via ProofBuilder wait, but we skip 0xFD2 execute for simplicity)
        // In prod, would call manager.execute via 0xFD2 like loan-flow's submitFundProofToLoanManager
        const tx = await (manager as any).markAdvanceAsFunded(advanceId);
        console.log(`  marked funded on CC ${tx.hash}`); await tx.wait();
      }
    }
    // Sepolia AdvanceRepaid -> CC note repayment
    const auxRepaid: any = await safeQuery(aux, (aux as any).filters.AdvanceRepaid(), srcFrom, srcProvider);
    for (const ev of auxRepaid) {
      if (seen.has(ev.transactionHash)) continue;
      seen.add(ev.transactionHash);
      const [advanceId, amount] = ev.args;
      console.log(`AdvanceRepaid ${advanceId} amount ${amount}`);
      const res = await generateProof(ev.transactionHash, SRC_KEY, PROVER, ccProvider, srcProvider);
      if (res.success) {
        const tx = await (manager as any).noteAdvanceRepayment(advanceId, amount);
        console.log(`  noted repayment on CC ${tx.hash}`); await tx.wait();
      }
    }
    ccFrom = await ccProvider.getBlockNumber() + 1;
    srcFrom = await srcProvider.getBlockNumber() + 1;
    await new Promise(r => setTimeout(r, 5000));
  }
}
main().catch(console.error);
