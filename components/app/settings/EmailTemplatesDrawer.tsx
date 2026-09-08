"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import EmailTemplateEditor from "./EmailTemplateEditor";

export default function EmailTemplatesDrawer({
  open,
  onClose,
  userProfileId,
}: {
  open: boolean;
  onClose: () => void;
  userProfileId: string | null;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="relative w-[480px] max-w-[95vw] h-full bg-canvas border-l border-border flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <p className="text-sm font-medium text-white">Email Templates</p>
              <button onClick={onClose} className="text-muted hover:text-white text-lg leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <EmailTemplateEditor userProfileId={userProfileId} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
