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
            Real-time payment streams carrying Travel Rule data and verifiable
            proofs of real-world transactions.
          </p>
        </div>

        <div className="md:col-span-2 md:col-start-6">
          <div className="font-mono text-xs uppercase tracking-widest text-muted mb-4">
            Product
          </div>
          <ul className="space-y-3 text-sm text-white/80">
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Protocol
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Verification
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Pricing
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
              <a href="#" className="hover:text-white transition-colors">
                Documentation
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Whitepaper
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
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
              <a href="#" className="hover:text-white transition-colors">
                About
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Blog
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-white transition-colors">
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 sm:gap-4 text-xs text-muted">
          <span>© 2026 AttestGO. All rights reserved.</span>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition-colors">
              Twitter
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Discord
            </a>
            <a href="#" className="hover:text-white transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
