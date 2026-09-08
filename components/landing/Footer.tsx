export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-12 sm:py-16 grid md:grid-cols-12 gap-8 sm:gap-10">
        <div className="md:col-span-4">
          <a href="#" className="flex items-center gap-1.5">
            <span className="font-display font-semibold text-lg tracking-tight text-white">
              attest
            </span>
            <span className="brand-tamg font-display text-sm">
              GO
            </span>
          </a>
          <p className="mt-4 text-sm text-muted max-w-xs leading-relaxed">
            Building the infrastructure for compliant onchain finance with verifiable proofs & AI composed inbox powered by Attestcoin Protocol.
          </p>
        </div>

        <div className="md:col-span-2 md:col-start-6">
          <div className="font-mono text-xs uppercase tracking-widest text-muted mb-4">
            Product
          </div>
          <ul className="space-y-3 text-sm text-white/80">
            <li>
              <a href="/app/discover" className="hover:text-white transition-colors">
                Discover
              </a>
            </li>
            <li>
              <a href="/app/send" className="hover:text-white transition-colors">
                Send
              </a>
            </li>
            <li>
              <a href="/app/defi" className="hover:text-white transition-colors">
                DeFi
              </a>
            </li>
          </ul>
        </div>
        <div className="md:col-span-2">
          <div className="font-mono text-xs uppercase tracking-widest text-muted mb-4">
            Resources
          </div>
          <ul className="space-y-3 text-sm text-white/80">
            <li>
              <a href="/docs" className="hover:text-white transition-colors">
                Documentation
              </a>
            </li>
            <li>
              <a href="/demo-products" className="hover:text-white transition-colors">
                Products
              </a>
            </li>
            <li>
              <a href="https://github.com/tamago-labs/attestgo-project" target="_blank" rel="noopener" className="hover:text-white transition-colors">
                GitHub
              </a>
            </li>
          </ul>
        </div>
        <div className="md:col-span-2">
          <div className="font-mono text-xs uppercase tracking-widest text-muted mb-4">
            Company
          </div>
          <ul className="space-y-3 text-sm text-white/80">
            <li>
              <a href="/#about" className="hover:text-white transition-colors">
                About
              </a>
            </li>
            <li>
              <a href="https://x.com/tamago_labs_JP" target="_blank" rel="noopener" className="hover:text-white transition-colors">
                Blog
              </a>
            </li>
            <li>
              <a href="/#contact" className="hover:text-white transition-colors">
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 sm:gap-4 text-xs text-muted">
          <span>© 2026 Tamago Labs. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <a href="https://x.com/tamago_labs_JP" target="_blank" rel="noopener" className="hover:text-white transition-colors">
              X
            </a>
            <a href="https://github.com/tamago-labs/attestgo-project" target="_blank" rel="noopener" className="hover:text-white transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
