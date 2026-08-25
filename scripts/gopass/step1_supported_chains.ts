/**
 * step1_supported_chains.ts — docs Step 1: Query supported chains
 * https://docs.creditcoin.org/attestcoin-protocol/dapp-builder-infrastructure/attestcoin-sdk-usc-sdk
 * Env: CREDITCOIN_RPC_URL
 */
import 'dotenv/config';
import { JsonRpcProvider } from 'ethers';
import { chainInfo } from '@gluwa/usc-sdk';

const CC_RPC = process.env.CREDITCOIN_RPC_URL || 'https://rpc.cc3-testnet.creditcoin.network';

async function main() {
  const creditcoinProvider = new JsonRpcProvider(CC_RPC);
  const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider);
  const supportedChains = await chainInfoProvider.getSupportedChains();
  console.log(supportedChains);
  // e.g. [{ chainKey: 1, chainId: 11155111, chainName: 'Ethereum Sepolia', chainEncoding: 1 }, ...]
  console.log(`\nchainKey for Sepolia: ${(supportedChains.find((c: any) => c.chainId === 11155111) as any)?.chainKey ?? supportedChains[0]?.chainKey} (use in every subsequent call)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
