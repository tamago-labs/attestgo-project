import 'dotenv/config';
import { Contract, ethers, EventLog } from 'ethers';

const managerAbi = [
  'function registerAdvance(tuple(address from, address to, address withToken) fundFlow, tuple(address from, address to, address withToken) repayFlow, tuple(uint256 loanAmount, uint256 interestRate, uint256 expectedRepaymentAmount, uint256 deadlineBlockNumber, uint256 collateralStreamId) terms, bytes sigLender, bytes sigBorrower) external returns (uint256)',
  'event AdvanceRegistered(uint256 indexed advanceId, address indexed lender, address indexed borrower, uint256 loanAmount, uint256 repayAmount, uint256 deadlineBlockNumber, uint256 collateralStreamId)',
] as const;

async function main() {
  const [amountArg, bpsArg, durationArg, streamIdArg] = process.argv.slice(2);
  if (!amountArg || !bpsArg || !durationArg) {
    console.error('Usage: npx tsx scripts/advance/3_create_advance.ts <amount> <bps> <durationBlocks> [streamId]');
    process.exit(1);
  }
  // amountArg can be human "10" or wei "10000000000000000000" — handle 18 decimals for KKUB
  const amountWei: bigint = amountArg.includes('.') || !amountArg.match(/^\d+$/) || amountArg.length > 15
    ? ethers.parseUnits(amountArg, 18)
    : (amountArg.length <= 6 ? ethers.parseUnits(amountArg, 18) : BigInt(amountArg)); // 10 → 10e18, 1000 → 1000e18 for demo
  const bps = Number(bpsArg), duration = Number(durationArg), streamId = Number(streamIdArg || 2);
  const ccRpc = process.env.CREDITCOIN_RPC_URL!;
  const managerAddr = process.env.ADVANCE_MANAGER_ADDRESS!;
  const tokenAddr = process.env.SOURCE_CHAIN_ERC20_CONTRACT_ADDRESS!;
  const lenderKey = process.env.LENDER_WALLET_PRIVATE_KEY!;
  const borrowerKey = process.env.BORROWER_WALLET_PRIVATE_KEY!;
  const pk = process.env.CREDITCOIN_WALLET_PRIVATE_KEY!;
  const ccProvider = new ethers.JsonRpcProvider(ccRpc);
  const wallet = new ethers.Wallet(pk, ccProvider);
  const lenderWallet = new ethers.Wallet(lenderKey, ccProvider);
  const borrowerWallet = new ethers.Wallet(borrowerKey, ccProvider);
  const manager = new Contract(managerAddr, managerAbi as any, wallet);
  const fundFlow = { from: lenderWallet.address, to: borrowerWallet.address, withToken: tokenAddr };
  const repayFlow = { from: borrowerWallet.address, to: lenderWallet.address, withToken: tokenAddr };
  const deadline = (await ccProvider.getBlockNumber()) + duration;
  const repayAmount = (amountWei * BigInt(10000 + bps)) / 10000n;
  const terms = { loanAmount: amountWei, interestRate: bps, expectedRepaymentAmount: repayAmount, deadlineBlockNumber: deadline, collateralStreamId: streamId };
  console.log('Registering advance', { fundFlow, repayFlow, terms, streamId });
  const payloadTypes = ['address','address','address','address','address','address','uint256','uint256','uint256','uint256','uint256'];
  const payload = [fundFlow.from, fundFlow.to, fundFlow.withToken, repayFlow.from, repayFlow.to, repayFlow.withToken, terms.loanAmount, terms.interestRate, terms.expectedRepaymentAmount, terms.deadlineBlockNumber, terms.collateralStreamId];
  const hash = ethers.solidityPackedKeccak256(payloadTypes, payload);
  const sigLender = await lenderWallet.signMessage(ethers.toBeArray(hash));
  const sigBorrower = await borrowerWallet.signMessage(ethers.toBeArray(hash));
  const blockBefore = await ccProvider.getBlockNumber();
  const tx = await (manager as any).registerAdvance(fundFlow, repayFlow, terms, sigLender, sigBorrower);
  console.log('registered tx', tx.hash); await tx.wait();
  // wait for event
  for (let i = 0; i < 10; i++) {
    const evs: any = await (manager as any).queryFilter((manager as any).filters.AdvanceRegistered(), blockBefore, await ccProvider.getBlockNumber());
    if (evs.length > 0) {
      const ev = evs[0] as EventLog;
      console.log('AdvanceId', ev.args.advanceId.toString());
      break;
    }
    await new Promise(r => setTimeout(r, 3000));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
