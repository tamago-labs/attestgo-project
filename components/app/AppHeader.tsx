"use client";

import { useState } from "react";
import { useWallet } from "./WalletContext";
import ButtonGlow from "@/components/ui/ButtonGlow";
import NetworkSwitcher from "./NetworkSwitcher";
import AvatarMenu from "./AvatarMenu";
import WalletModal from "./WalletModal";

export default function AppHeader() {
  const { isConnected } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <header className="h-16 border-b border-border bg-panel/50 backdrop-blur-md flex items-center justify-between px-6">
        <div />
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <NetworkSwitcher />
              <AvatarMenu />
            </>
          ) : (
            <ButtonGlow onClick={() => setModalOpen(true)} className="px-4 py-2 rounded-lg">
              Connect Wallet
            </ButtonGlow>
          )}
        </div>
      </header>
      <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
