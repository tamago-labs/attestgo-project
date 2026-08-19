export default function AppHeader() {
  return (
    <header className="h-16 border-b border-border bg-panel/50 backdrop-blur-md flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted">0x1234…5678</span>
        <button className="rounded-md border border-border px-3 py-1.5 text-sm text-white hover:bg-white/5 transition-colors">
          Connect Wallet
        </button>
      </div>
    </header>
  );
}
