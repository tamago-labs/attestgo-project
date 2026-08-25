"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { useWallet } from "./WalletContext";
import { buildMessage, saveProfile } from "@/lib/userProfile";

const COUNTRIES = [
  { code: "US", label: "United States — US" },
  { code: "SG", label: "Singapore — SG" },
  { code: "JP", label: "Japan — JP" },
  { code: "HK", label: "Hong Kong — HK" },
  { code: "DE", label: "Germany — DE" },
  { code: "CN", label: "China — CN" },
  { code: "GB", label: "United Kingdom — GB" },
  { code: "FR", label: "France — FR" },
  { code: "AE", label: "UAE — AE" },
  { code: "CH", label: "Switzerland — CH" },
];

export default function EditProfileModal({
  open,
  initialName,
  initialCountry,
  onClose,
  onSaved,
}: {
  open: boolean;
  initialName: string;
  initialCountry: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { address, signer } = useWallet();
  const [displayName, setDisplayName] = useState(initialName);
  const [country, setCountry] = useState(initialCountry || "US");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDisplayName(initialName);
      setCountry(initialCountry || "US");
      setError(null);
    }
  }, [open, initialName, initialCountry]);

  const handleSave = async () => {
    const name = displayName.trim();
    if (!name) {
      setError("Display name required");
      return;
    }
    if (!address || !signer) {
      setError("Connect wallet to sign");
      return;
    }
    setSaving(true);
    setError(null);
    // phase 1: sign — must show wallet prompt before any AppSync call
    let message: string;
    let signature: string;
    try {
      message = buildMessage(address, name, country);
      signature = await (signer as unknown as { signMessage: (m: string) => Promise<string> }).signMessage(message);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg?.includes("User rejected") ? "Signature rejected" : msg || "Failed to sign");
      setSaving(false);
      return;
    }
    // phase 2: save via AppSync (Amplify must be configured)
    try {
      await saveProfile({ walletAddress: address, displayName: name, country, message, signature });
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-md rounded-xl border border-border bg-panel p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-white">Edit profile</h3>
              <button onClick={onClose} className="p-1 text-muted hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Full name (as on ID)</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivera"
                  maxLength={32}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-canvas border border-border text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-white/80 uppercase tracking-widest">Country</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-lg bg-canvas border border-border text-sm text-white focus:outline-none focus:border-violet-500/50"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              {error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-border text-sm text-muted hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90 disabled:opacity-60 inline-flex items-center gap-2"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />} Sign & Save
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
