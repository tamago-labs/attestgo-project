"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Contract, parseUnits, type Signer } from "ethers";
import { uploadData } from "aws-amplify/storage";
import { formatUnits, chainName, type UnifiedRow } from "@/lib/send";
import { buildEmailSubject, buildEmailBody, CAUSES, type CauseId } from "@/lib/send/emailTemplates";
import { truncateAddr } from "@/lib/send/constants";
import TokenIcon from "./TokenIcon";
import AddressBookDrawer from "@/components/app/AddressBookDrawer";
import TravelRuleAccordion from "./TravelRuleAccordion";
import DocumentAccordion from "./DocumentAccordion";
import ReviewPanel from "./ReviewPanel";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
] as const;

export default function SendDrawer({
  open,
  row,
  balance,
  onClose,
  onSend,
  onSuccess,
  priceMap,
  ownerId,
  ownerProfile,
  walletAddress,
  signer,
  walletChainId,
}: {
  open: boolean;
  row: UnifiedRow;
  balance: bigint | undefined;
  onClose: () => void;
  onSend: () => void;
  onSuccess: (details: { txHash: string; amount: string; recipient: string }) => void;
  priceMap?: Record<string, number>;
  ownerId?: string | null;
  ownerProfile?: { displayName: string; country: string } | null;
  walletAddress?: string | null;
  signer: Signer | null;
  walletChainId: number | null;
}) {
  if (!row) return null;
  const balText = balance !== undefined ? formatUnits(balance, row.decimals) : "…";
  const [bookOpen, setBookOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [cause, setCause] = useState<CauseId>("payment");
  const [customNote, setCustomNote] = useState("");

  const [beneName, setBeneName] = useState("");
  const [beneInstitution, setBeneInstitution] = useState("");
  const [beneCountry, setBeneCountry] = useState("");
  const [beneSelfCustody, setBeneSelfCustody] = useState(true);

  const [travelOpen, setTravelOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setAmount("");
      setRecipient("");
      setCause("payment");
      setCustomNote("");
      setBeneName("");
      setBeneInstitution("");
      setBeneCountry("");
      setBeneSelfCustody(true);
      setTravelOpen(false);
      setDocOpen(false);
      setFile(null);
      setUploading(false);
      setUploadProgress(0);
      setUploadedPath(null);
      setUploadError(null);
      setSending(false);
      setSendError(null);
    }
  }, [open]);

  const handleUpload = async (f: File | null) => {
    if (!f) {
      setFile(null);
      setUploadedPath(null);
      return;
    }
    setFile(f);
    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadedPath(null);
    try {
      const result = await uploadData({
        path: `docs/${Date.now()}_${f.name}`,
        data: f,
        options: {
          contentType: f.type,
          onProgress: ({ transferredBytes, totalBytes }) => {
            if (totalBytes) setUploadProgress(Math.round((transferredBytes / totalBytes) * 100));
          },
        },
      }).result;
      setUploadedPath(result.path);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleReview = () => {
    setSendError(null);
    setStep(2);
  };

  const handleConfirmSend = async () => {
    if (!walletAddress || !signer) return;
    setSending(true);
    setSendError(null);
    try {
      // Execute ERC20 transfer
      const token = new Contract(row.address, ERC20_ABI, signer);
      const dec = row.decimals;
      const amt = parseUnits(amount, dec);
      const tx = await token.transfer(recipient, amt);
      const rc = await tx.wait();

      const senderName = ownerProfile?.displayName || (walletAddress ? truncateAddr(walletAddress) : "Unknown");
      const recipientName = beneName || truncateAddr(recipient);
      const subject = buildEmailSubject(cause, row.symbol, amount);
      const emailBody = buildEmailBody({
        cause,
        customNote: customNote || undefined,
        senderName,
        recipientName,
        amount,
        asset: row.symbol,
        hasDoc: !!uploadedPath,
      });

      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: tx.hash,
          originatorWallet: walletAddress,
          originatorName: senderName,
          originatorCountry: ownerProfile?.country || "",
          beneficiaryWallet: recipient,
          beneficiaryName: recipientName,
          beneficiaryInstitution: beneInstitution,
          beneficiaryCountry: beneCountry,
          beneficiaryIsSelfHosted: beneSelfCustody,
          amount,
          asset: row.symbol,
          senderId: ownerId,
          cause,
          customNote,
          emailSubject: subject,
          emailBody,
          docs: uploadedPath ? [uploadedPath] : [],
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `API error ${res.status}`);
      }

      onSuccess({ txHash: tx.hash, amount, recipient });
      onClose();
      onSend();
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const wrongChain = walletChainId !== null && walletChainId !== row.chainId;
  const canReview = recipient.startsWith("0x") && recipient.length === 42 && Number(amount) > 0 && beneName && beneCountry && !wrongChain;

  return (
    <>
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative w-[480px] max-w-[95vw] h-full bg-canvas border-l border-border flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                {step === 2 && (
                  <button onClick={() => setStep(1)} className="text-muted hover:text-white mr-1">←</button>
                )}
                <TokenIcon icon={row.icon} symbol={row.symbol} size={20} />
                <p className="text-sm font-medium text-white">
                  {step === 1 ? `Send ${row.symbol}` : "Review & send"}
                </p>
              </div>
              <button onClick={onClose} className="text-muted hover:text-white text-lg leading-none">&times;</button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {step === 1 ? (
                <>
                  {/* Amount */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-muted text-xs">Amount</label>
                      <span className="text-muted text-xs">Balance: <span className="text-white/60 font-mono">{balText}</span></span>
                    </div>
                    <div className="border border-border rounded-lg px-3 py-2.5 flex items-center gap-2">
                      <TokenIcon icon={row.icon} symbol={row.symbol} size={18} />
                      <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} type="number" className="bg-transparent outline-none text-lg font-semibold text-white w-full" placeholder="0.00" />
                      <button onClick={() => setAmount(balText !== "…" ? balText : "")} className="text-amber text-xs font-medium shrink-0">Max</button>
                    </div>
                  </div>

                  {/* To */}
                  <div>
                    <label className="text-muted text-xs mb-1.5 block">To</label>
                    <div className="flex items-center gap-2">
                      <input value={recipient} onChange={(e) => setRecipient(e.target.value)} className="flex-1 border border-border rounded-lg px-3 py-2.5 text-sm font-mono bg-transparent outline-none text-white/70" placeholder="0x... or GO Pass address" />
                      <button onClick={() => setBookOpen(true)} className="px-3 py-2.5 rounded-lg border border-border text-xs text-muted hover:text-white hover:bg-white/[0.04] transition-colors whitespace-nowrap">Address book</button>
                    </div>
                  </div>

                  {/* Wrong chain warning */}
                  {wrongChain && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      <p className="text-xs text-red-300">Wrong network — switch to {chainName(row.chainId)} to send {row.symbol}.</p>
                    </div>
                  )}

                  {/* Cause */}
                  <div>
                    <label className="text-muted text-xs mb-1.5 block">Transfer purpose</label>
                    <select value={cause} onChange={(e) => setCause(e.target.value as CauseId)} className="w-full border border-border rounded-md px-3 py-2.5 text-sm bg-panel outline-none text-white">
                      {CAUSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    {cause === "other" && (
                      <textarea value={customNote} onChange={(e) => setCustomNote(e.target.value)} rows={2} className="w-full border border-border rounded-md px-3 py-2 text-sm bg-panel outline-none text-white resize-none mt-2" placeholder="Describe the purpose…" />
                    )}
                  </div>
                </>
              ) : (
                <ReviewPanel
                  amount={amount}
                  symbol={row.symbol}
                  recipient={recipient}
                  cause={cause}
                  customNote={customNote}
                  beneName={beneName}
                  beneCountry={beneCountry}
                  beneInstitution={beneInstitution}
                  file={file}
                  uploadedPath={uploadedPath}
                />
              )}
            </div>

            {/* Step 1 accordions — below scroll area */}
            {step === 1 && (
              <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                <TravelRuleAccordion
                  open={travelOpen}
                  onToggle={() => setTravelOpen((v) => !v)}
                  recipient={recipient}
                  ownerProfile={ownerProfile}
                  walletAddress={walletAddress}
                  beneName={beneName}
                  onBeneNameChange={setBeneName}
                  beneInstitution={beneInstitution}
                  onBeneInstitutionChange={setBeneInstitution}
                  beneCountry={beneCountry}
                  onBeneCountryChange={setBeneCountry}
                  beneSelfCustody={beneSelfCustody}
                  onBeneSelfCustodyChange={setBeneSelfCustody}
                />
                <DocumentAccordion
                  open={docOpen}
                  onToggle={() => setDocOpen((v) => !v)}
                  file={file}
                  uploadedPath={uploadedPath}
                  uploading={uploading}
                  uploadProgress={uploadProgress}
                  uploadError={uploadError}
                  onFileSelect={handleUpload}
                />
              </div>
            )}

            {/* Bottom action */}
            <div className="border-t border-border p-4">
              {step === 1 ? (
                <button onClick={handleReview} disabled={!canReview} className="w-full py-2.5 rounded-md bg-amber text-canvas text-sm font-medium hover:bg-amber/90 disabled:opacity-40 transition-colors">
                  Review
                </button>
              ) : (
                <div className="space-y-2">
                  {sendError && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{sendError}</div>}
                  <button onClick={handleConfirmSend} disabled={sending} className="w-full py-2.5 rounded-md bg-amber text-canvas text-sm font-medium hover:bg-amber/90 disabled:opacity-40 transition-colors">
                    {sending ? "Sending…" : "Confirm & send"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    <AddressBookDrawer open={bookOpen} onClose={() => setBookOpen(false)} onSelect={(addr) => { setRecipient(addr); setBookOpen(false); }} ownerId={ownerId || null} />
    </>
  );
}
