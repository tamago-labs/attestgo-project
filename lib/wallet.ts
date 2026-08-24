import { ethers } from "ethers";
import { getAddChainParams, getChainById } from "./chains";

export type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export type EIP6963ProviderDetail = {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: EIP1193Provider;
};

export type WalletInfo = EIP6963ProviderDetail["info"];

export type Wallet = {
  info: WalletInfo;
  provider: EIP1193Provider;
};

/**
 * Discover all EIP-6963 wallets.
 * Wallet-agnostic: treats every announcement identically, deduped by uuid.
 */
export function discoverWallets(timeoutMs = 400): Promise<Wallet[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  return new Promise((resolve) => {
    const wallets = new Map<string, Wallet>();

    function handleProvider(event: Event) {
      const { info, provider } = (event as CustomEvent<EIP6963ProviderDetail>).detail;
      wallets.set(info.uuid, { info, provider });
    }

    window.addEventListener("eip6963:announceProvider", handleProvider as EventListener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", handleProvider as EventListener);
      resolve(Array.from(wallets.values()));
    }, timeoutMs);
  });
}

/**
 * Connect to selected wallet and return ethers provider + signer + address.
 */
export async function connectWallet(wallet: Wallet) {
  await wallet.provider.request({ method: "eth_requestAccounts" });
  const provider = new ethers.BrowserProvider(wallet.provider as unknown as ethers.Eip1193Provider);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();
  return { wallet, provider, signer, address, chainId: Number(network.chainId) };
}

export async function switchChain(provider: EIP1193Provider, chainId: number) {
  const hex = `0x${chainId.toString(16)}`;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hex }],
    });
  } catch (err: unknown) {
    const e = err as { code?: number };
    // 4902 = chain not added
    if (e?.code === 4902) {
      const chain = getChainById(chainId);
      if (!chain) throw err;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [getAddChainParams(chain)],
      });
    } else {
      throw err;
    }
  }
}

export async function getChainId(provider: ethers.BrowserProvider): Promise<number> {
  const network = await provider.getNetwork();
  return Number(network.chainId);
}

export function truncateAddress(addr: string): string {
  if (!addr) return "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
