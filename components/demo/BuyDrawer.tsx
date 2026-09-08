"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, ExternalLink } from "lucide-react";
import { useWallet } from "@/components/app/WalletContext";
import { JsonRpcProvider, Contract, formatUnits, parseUnits } from "ethers";

const SEPOLIA_RPC = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia.publicnode.com";
const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)", "function approve(address,uint256) returns (bool)", "function allowance(address,address) view returns (uint256)"];

export default function BuyDrawer({ open, onClose, symbol, tokenAddress, chainId, payToken, paymentToken, marketAddress }: { open: boolean; onClose: () => void; symbol: string; tokenAddress: string; chainId: number; payToken?: string; paymentToken?: string; marketAddress?: string }) {
  const paySymbol = payToken || paymentToken || (symbol === "aN225" ? "JPYC" : "USDT");
  const { address, signer } = useWallet() as any;
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("1");
  const [payBal, setPayBal] = useState<string>("—");
  const [rwaBal, setRwaBal] = useState<string>("—");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [payAddr, setPayAddr] = useState<string>(payToken === "JPYC" || symbol === "aN225" ? "0xB8712751fFBe66DA15f2aCCCf0DFE8071Cc2E5D0" : "0x8d1A804D73CA595A8538C805Daef6FE8Ec68137B");
  const market = marketAddress || (symbol === "aN225" ? "0xd19d94035CA56B02c889396975FA12Fb6f72B73D" : "0x7eE76595B70991cE74812b4B352fb032B11B508B");
  const explorer = "https://sepolia.etherscan.io";

  useEffect(() => {
    if (!open || !marketAddress) return;
    const run = async () => {
      try {
        const p = new JsonRpcProvider(SEPOLIA_RPC);
        const m = new Contract(market, ["function paymentToken() view returns (address)"], p);
        const pt = await m.paymentToken();
        if (pt && pt !== "0x0000000000000000000000000000000000000000") setPayAddr(pt);
      } catch {}
    };
    run();
  }, [open, market]);

  useEffect(() => {
    if (!open || !address) return;
    const run = async () => {
      try {
        const p = new JsonRpcProvider(SEPOLIA_RPC);
        const pay = new Contract(payAddr, ERC20_ABI, p);
        const rwa = new Contract(tokenAddress, ERC20_ABI, p);
        const [pb, rb, pd, rd] = await Promise.all([pay.balanceOf(address), rwa.balanceOf(address), pay.decimals(), rwa.decimals()]);
        setPayBal(formatUnits(pb, Number(pd)));
        setRwaBal(formatUnits(rb, Number(rd)));
      } catch {}
    };
    run();
  }, [open, address, payAddr, tokenAddress]);

  const pricePerRwa = symbol === "aN225" ? 38500 : 1.0247;
  const priceScaled = symbol === "aN225" ? BigInt("38500000000000000000000") : BigInt("1024700000000000000"); // 38500e18 / 1.0247e18
  const payDec = symbol === "aN225" ? 18 : 6;
  const previewRwa = (() => {
    const v = parseFloat(amount || "0");
    if (!v || !pricePerRwa) return "0";
    return (v / pricePerRwa).toFixed(v / pricePerRwa < 0.01 ? 6 : 4);
  })();
  const handleBuy = async () => {
    if (!address || !signer) return;
    setLoading(true);
    setTxHash(null);
    try {
      const s = signer as any;
      const payAmt = parseUnits(amount || "0", payDec);
      // rwaAmt = payAmt * 1e18 * 10^rwaDec / (priceScaled * 10^payDec) ; rwaDec 18
      const rwaAmt = (payAmt * BigInt(10 ** 18) * BigInt(1e18)) / (priceScaled * BigInt(10 ** payDec));
      const connectedPay = new Contract(payAddr, ["function approve(address,uint256) returns (bool)", "function allowance(address,address) view returns (uint256)"], s);
      const m = new Contract(market, ["function buy(uint256) external"], s);
      const allowance: bigint = await connectedPay.allowance(address, market);
      if (allowance < payAmt) {
        const tx = await connectedPay.approve(market, payAmt);
        await tx.wait();
      }
      const tx = await m.buy(rwaAmt);
      setTxHash(tx.hash);
      await tx.wait();
    } catch (e: any) {
      console.error(e);
    } finally { setLoading(false); }
  };
  const handleSell = async () => {
    if (!address || !signer) return;
    setLoading(true);
    setTxHash(null);
    try {
      const s = signer as any;
      const rwa = new Contract(tokenAddress, ["function approve(address,uint256) returns (bool)", "function allowance(address,address) view returns (uint256)"], s);
      const m = new Contract(market, ["function sell(uint256) external"], s);
      const amt = parseUnits(amount || "0", 18);
      const allowance: bigint = await rwa.allowance(address, market);
      if (allowance < amt) {
        const tx = await rwa.approve(market, amt);
        await tx.wait();
      }
      const tx = await m.sell(amt);
      setTxHash(tx.hash);
      await tx.wait();
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative w-[420px] max-w-[95vw] h-full bg-white border-l border-slate-200 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <p className="text-sm font-medium">Buy {symbol} — {symbol === "aN225" ? "38,500" : "1.0247"} {paySymbol}</p>
              <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"><X size={14} /></button>
            </div>
            <div className="px-5 pt-3 flex gap-2">
              <button onClick={() => setTab("deposit")} className={`flex-1 py-2 rounded-full text-sm ${tab === "deposit" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"}`}>Deposit / Buy</button>
              <button onClick={() => setTab("withdraw")} className={`flex-1 py-2 rounded-full text-sm ${tab === "withdraw" ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"}`}>Withdraw / Sell</button>
            </div>
            <div className="flex-1 p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">{paySymbol} balance</p><p className="font-mono text-sm font-medium mt-1 truncate">{payBal}</p></div>
                <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">{symbol} balance</p><p className="font-mono text-sm font-medium mt-1 truncate">{rwaBal}</p></div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{tab === "deposit" ? `Buy ${symbol} with ${paySymbol} at NAV. GO Pass tier ≥10 required.` : `Sell ${symbol} for ${paySymbol} at NAV.`}</p>
              <div>
                <label className="text-xs font-medium text-slate-700">Amount ({tab === "deposit" ? paySymbol : symbol})</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-slate-900" placeholder={tab === "deposit" ? "60000" : "1"} />
                <p className="text-xs text-slate-500 mt-1">{tab === "deposit" ? `≈ ${previewRwa} ${symbol} · ${pricePerRwa.toLocaleString()} ${paySymbol} per ${symbol}` : `≈ ${(parseFloat(amount || "0") * pricePerRwa).toLocaleString()} ${paySymbol} · ${pricePerRwa} ${paySymbol} per ${symbol}`}</p>
              </div>
              {!address && <p className="text-xs text-amber-600">Connect wallet to trade.</p>}
              {txHash && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shrink-0">✓</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-emerald-800">Bought {tab === "deposit" ? previewRwa : amount} {symbol}</p>
                    <a href={`${explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700 underline mt-1">View on explorer <ExternalLink size={10} /></a>
                  </div>
                </div>
              )}
              <div className="flex gap-3 text-xs">
                <a href={`${explorer}/address/${tokenAddress}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 underline">View {symbol} on explorer <ExternalLink size={10} /></a>
                <a href={`${explorer}/address/${market}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 underline">View market on explorer <ExternalLink size={10} /></a>
              </div>
            </div>
            <div className="border-t border-slate-200 p-4">
              {tab === "deposit" ? (
                <button onClick={handleBuy} disabled={loading || !address} className="w-full py-2.5 rounded-lg bg-[#0A0A0F] text-white text-sm font-medium hover:bg-black disabled:opacity-40 inline-flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : null} Buy {symbol} with {paySymbol}
                </button>
              ) : (
                <button onClick={handleSell} disabled={loading || !address} className="w-full py-2.5 rounded-lg bg-white border border-slate-900 text-slate-900 text-sm font-medium hover:bg-slate-50 disabled:opacity-40 inline-flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : null} Sell {symbol} for {paySymbol}
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
