"use client";

import { motion, AnimatePresence } from "framer-motion";

export default function DocumentAccordion({
  open,
  onToggle,
  file,
  uploadedPath,
  uploading,
  uploadProgress,
  uploadError,
  onFileSelect,
}: {
  open: boolean;
  onToggle: () => void;
  file: File | null;
  uploadedPath: string | null;
  uploading: boolean;
  uploadProgress: number;
  uploadError: string | null;
  onFileSelect: (f: File) => void;
}) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-white">Supporting document</span>
          <span className="text-[10px] text-muted">(optional)</span>
          {uploadedPath && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">attached</span>
          )}
        </div>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-white/40 text-xs">▼</motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border">
              {!uploadedPath ? (
                <label className="block pt-3 cursor-pointer">
                  <div className="border border-dashed border-border rounded-lg p-4 text-center hover:border-amber/40 transition-colors">
                    <p className="text-muted text-xs">Drop a file or <span className="text-amber">browse</span></p>
                    <p className="text-muted text-[10px] mt-1">Invoice, agreement, or source-of-funds — PDF, PNG, JPG</p>
                    {uploading && (
                      <div className="mt-3">
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-amber rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                        </div>
                        <p className="text-[10px] text-muted mt-1">{uploadProgress}%</p>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onFileSelect(f);
                    }}
                  />
                </label>
              ) : (
                <div className="flex items-center justify-between pt-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-emerald-400 text-sm">✓</span>
                    <span className="text-xs text-white truncate">{file?.name}</span>
                    <span className="text-[10px] text-muted shrink-0">({(file!.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button
                    onClick={() => onFileSelect(null as unknown as File)}
                    className="text-xs text-muted hover:text-red-400 shrink-0"
                  >
                    Remove
                  </button>
                </div>
              )}
              {uploadError && <p className="text-[11px] text-red-300 mt-2">{uploadError}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
