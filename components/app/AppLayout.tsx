import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";
import { WalletProvider } from "./WalletContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <div className="flex h-screen overflow-hidden bg-base">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </WalletProvider>
  );
}
