import CodeBlock from "@/components/docs/CodeBlock";

const BASE = "https://9aozj1j64j.execute-api.ap-southeast-1.amazonaws.com/prod";
const FACTORY = "0xEB263edDaED69C1bAc361Db2E50eAe6813145803";
const GOPASS = "0x9236590Ffa4FA7B633F1F6ce3a23338b532a5302";
const REGISTRY = "0xF3475177692D1D88a34c4E9a508D4ee6d17DFB68";

export default function DocsPage() {
  return (
    <div className="space-y-10">
      {/* Early stage banner */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
        <span className="mt-0.5 w-2 h-2 rounded-full bg-amber-400 shrink-0" />
        <div className="text-sm leading-5">
          <span className="font-semibold text-amber-300">Early Stage — Testnet Only.</span>{" "}
          <span className="text-amber-200/80">
            AttestGO is in active development on Sepolia (11155111) + Creditcoin testnet. Breaking changes may occur. Do not use mainnet
            funds. Rate-limited. No SLA.
          </span>
        </div>
      </div>

      {/* Hero */}
      <div className="space-y-4">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white">AttestGO API Guide</h1>
        <p className="text-muted max-w-3xl leading-6">
          REST API to issue and query <span className="text-white">GToken</span> (compliant ERC20) via{" "}
          <span className="text-white font-mono text-sm">GTokenFactory {FACTORY.slice(0, 10)}…</span> on Sepolia. Platform pays gas, issuer
          becomes <code className="text-white/80">owner</code>. For product overview see{" "}
          <a href="#overview" className="text-white underline underline-offset-4 hover:text-amber-300">
            Overview
          </a>{" "}
          below — this page is the API reference (testnet, breaking changes expected).
        </p>
        <div className="flex flex-wrap gap-3">
          <a href="#quickstart" className="px-4 py-2 rounded-lg bg-white text-canvas text-sm font-medium hover:bg-white/90">
            Quickstart
          </a>
          <a href="#endpoints" className="px-4 py-2 rounded-lg border border-border bg-panel text-sm text-white hover:bg-panel/80">
            API Reference
          </a>
        </div>
      </div>

      <section id="overview" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-white">Overview</h2>
        <p className="text-muted leading-6">
          AttestGO provides verified identity (GO Pass) and compliant assets (GToken) — KYC from Sepolia (hub{" "}
          <code className="text-white/80">GOPass</code> <span className="font-mono text-xs">{GOPASS}</span>) attested to Creditcoin registry{" "}
          <span className="font-mono text-xs">{REGISTRY}</span> via Attestcoin Protocol, enforced per-token{" "}
          <code className="text-white/80">Rule</code> (<code className="text-white/80">isEligible</code> per holder/transfer).
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { k: "01", t: "Verified Identity", d: "Mint GO Pass on Sepolia, attest to Creditcoin via prover 0x0FD2 verifySingle." },
            { k: "02", t: "Compliant Asset", d: "GToken (ERC20) with rule + underlying; mint or wrap/unwrap 1:1." },
            { k: "03", t: "Compliant Transfer", d: "beforeTokenTransfer checks both from/to isEligible, paused/whenNotPaused." },
          ].map((c) => (
            <div key={c.k} className="rounded-xl border border-border bg-panel p-4">
              <div className="text-xs font-mono text-muted">{c.k}</div>
              <div className="font-semibold text-white mt-1">{c.t}</div>
              <div className="text-sm text-muted mt-1 leading-5">{c.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-white">How it works</h2>
        <ol className="space-y-2 text-sm text-muted list-decimal list-inside leading-6">
          <li>
            User creates <span className="text-white">UserProfile</span> + wallet signature → <span className="text-white">mintPass</span> mints GO Pass
            record on Sepolia.
          </li>
          <li>
            <span className="text-white">attestPass</span> builds USC proof (<code className="text-white/80">ProofBuilder chainKey 1</code>) →{" "}
            <code className="text-white/80">verifySingle</code> + <code className="text-white/80">syncPassWithTxProof</code> on Creditcoin →{" "}
            <code className="text-white/80">setActive</code>.
          </li>
          <li>
            Issuer calls <span className="text-white">POST /tokens</span> with <code className="text-white/80">issuer</code> (tokenOwner) → factory{" "}
            <code className="text-white/80">createGTokenFor / createWrappedGTokenFor</code> <span className="font-mono text-xs">{FACTORY}</span> →{" "}
            <span className="text-white">TokenRecord</span> indexed by <code className="text-white/80">listByIssuer</code>.
          </li>
        </ol>
      </section>

      <section id="quickstart" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-white">Quickstart (testnet)</h2>
        <div className="rounded-xl border border-border bg-panel p-4 space-y-2 text-sm">
          <div className="text-muted">1. Have issuer address ready (will become <code className="text-white/80">GToken.owner()</code>). 2. Call — platform pays gas:</div>
        </div>
        <CodeBlock
          title="curl — issue example T-Bill token"
          lang="bash"
          code={`curl -X POST ${BASE}/tokens \\
  -H "x-platform-api-key: 1122334455667788" \\
  -H "Content-Type: application/json" \\
  -d '{
    "issuer": "0x3D63Ce608deB81f9436198A93BCC2e8f3D79F56E",
    "name": "USD T-Bill 6M",
    "symbol": "TBILL-6M",
    "minTier": 10,
    "countries": ["us","sg"],
    "iconURI": "https://icons.test/tbill-6m.svg"
  }'
# wrapped (backed by USDC) — same API, add underlying
# curl -X POST ${BASE}/tokens ... -d '{"issuer":"0x...","name":"wUSD T-Bill","symbol":"wTBILL","countries":["us"],"underlying":"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"}'
# response 201: { tokenAddress, txHash, blockNumber:0, pending:true, chainId:11155111, countries:["us","sg"] }`}
        />
        <CodeBlock
          title="curl — list tokens by issuer (GET, no auth)"
          lang="bash"
          code={`curl "${BASE}/tokens?issuer=0x3D63Ce608deB81f9436198A93BCC2e8f3D79F56E"
# {"items":[{"tokenAddress":"0xbbf9...","symbol":"TBILL-2","countries":["us"],"ruleBitmap":"1","txHash":"0x82da...","blockNumber":0}],"count":1}
curl "${BASE}/tokens?issuer=0x3D63Ce608deB81f9436198A93BCC2e8f3D79F56E&limit=20"
# also via Data: TokenRecord.listByIssuer({issuer: lower})
# via AppSync: POST https://...appsync-api.ap-southeast-1.amazonaws.com/graphql -H "x-api-key: da2-..." -d '{"query":"query Q($i:String!){listByIssuer(issuer:$i){items{tokenAddress symbol countries:countries txHash blockNumber}}}", "variables":{"i":"0x3d63..."}}'`}
        />
        <p className="text-xs text-muted">
          <code className="text-white/80">GET /tokens?issuer=0x...&limit=50&nextToken=...</code> public, paginated{" "}
          <code className="text-white/80">{`{items, nextToken, count}`}</code>. <code className="text-white/80">POST</code> returns{" "}
          <code className="text-white/80">pending:true blockNumber:0</code> until mined; GET shows updated <code className="text-white/80">blockNumber</code>.
        </p>
      </section>

      <section id="auth" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-white">Authentication</h2>
        <p className="text-muted leading-6 text-sm">Token creation requires a platform API key (provided separately). Send one of:</p>
        <CodeBlock lang="http" code={`x-platform-api-key: 1122334455667788  # shared test key — may change, contact us for your own
# aliases accepted: x-api-key, Authorization: Bearer 1122334455667788`} />
        <p className="text-xs text-muted">
          Invalid key → <code className="text-white/80">401 {"{"}error: "unauthorized: invalid platform api key"{"}"}</code>. Reading tokens (
          <code className="text-white/80">GET /tokens</code>) is public — no key needed.
        </p>
      </section>

      <section id="endpoints" className="scroll-mt-24 space-y-6">
        <h2 className="font-display text-xl font-semibold text-white">Endpoints</h2>

        <div className="rounded-xl border border-border bg-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-white">POST /tokens — create</span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/20">x-platform-api-key</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="font-mono text-xs text-muted break-all">{BASE}/tokens</div>
            <div className="text-muted">
              Body <span className="text-white">issuer</span> (required, address → becomes <code className="text-white/80">GToken.owner()</code>),{" "}
              <span className="text-white">name/symbol</span>, <span className="text-white">minTier</span> 0..255 (default 10),{" "}
              <span className="text-white">countries</span> <code className="text-white/80">[&quot;us&quot;,&quot;sg&quot;]</code> (allowed{" "}
              <code className="text-white/80">us sg jp hk de cn gb fr ae ch</code> — backend converts to bitmap), <span className="text-white">iconURI</span>,{" "}
              <span className="text-white">underlying</span> (0x0 native else wrapped ERC20).
            </div>
            <CodeBlock
              lang="json"
              title="Request"
              code={`{
  "issuer": "0x3D63Ce608deB81f9436198A93BCC2e8f3D79F56E",
  "name": "USD T-Bill",
  "symbol": "TBILL",
  "minTier": 10,
  "countries": ["us"],
  "iconURI": "https://icons.test/tbill.svg",
  "underlying": "0x0000000000000000000000000000000000000000"
}`}
            />
            <CodeBlock
              lang="json"
              title="Response 201"
              code={`{
  "tokenAddress": "0xabc...123",
  "chainId": 11155111,
  "factoryAddress": "${FACTORY.toLowerCase()}",
  "issuer": "0x3d63...56e",
  "name": "USD T-Bill",
  "symbol": "TBILL",
  "decimals": 18,
  "underlying": "0x0000000000000000000000000000000000000000",
  "isWrapped": false,
  "countries": ["us"],
  "countriesBitmap": "1",
  "txHash": "0x...",
  "blockNumber": 0,
  "pending": true
}`}
            />
            <div className="text-xs text-muted">Success even if <code className="text-white/80">blockNumber:0</code> — tx broadcast, async waiter updates record after 1 conf. Retry safe (dedup by tokenAddress).</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">GET /tokens</span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-white/10 text-muted">public</span>
          </div>
          <p className="text-sm text-muted">
            REST: <code className="text-white/80">GET /tokens?issuer=0x3d63...&limit=50&nextToken=...</code> →{" "}
            <code className="text-white/80">{`{items: [{tokenAddress, symbol, countries:["us"], ruleBitmap:"1", ...}], nextToken, count}`}</code>{" "}
            (public, no <code className="text-white/80">x-platform-api-key</code>). Also{" "}
            <code className="text-white/80">GET /tokens</code> lists all (paginated). AppSync alternative:{" "}
            <code className="text-white/80">listByIssuer / listByChain</code>.
          </p>
          <CodeBlock
            lang="bash"
            code={`curl "${BASE}/tokens?issuer=0x3D63Ce608deB81f9436198A93BCC2e8f3D79F56E"
# {"items":[{"tokenAddress":"0xbbf9...","symbol":"TBILL-2","countries":["us"],"ruleBitmap":"1","txHash":"0x82da...","blockNumber":0}],"nextToken":null,"count":1}`}
          />
        </div>
      </section>

      <section id="issuers" className="scroll-mt-24 space-y-6">
        <h2 className="font-display text-xl font-semibold text-white">Issuer Profile Management</h2>
        <p className="text-muted text-sm leading-6">Register your organization — handle is unique (<code className="text-white/80">3-20 a-z0-9_</code>). You submit as <code className="text-white/80">pending</code>, admin verifies in console to <code className="text-white/80">verified</code>. One verification unlocks many listings and announcements.</p>

        <div className="rounded-xl border border-border bg-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-white">POST /issuers — create issuer</span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/20">x-platform-api-key</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="font-mono text-xs text-muted break-all">{BASE}/issuers</div>
            <div className="text-muted">Create profile <span className="text-white">issuerName handle ownerWallet</span> required, <span className="text-white">website description logoURI</span> optional. Returns <code className="text-white/80">pending</code> until verified.</div>
            <CodeBlock lang="bash" title="curl — create issuer (pending)" code={`curl -X POST ${BASE}/issuers \\
  -H "x-platform-api-key: 1122334455667788" \\
  -H "Content-Type: application/json" \\
  -d '{
    "issuerName": "SBI Asset Management",
    "handle": "sbi_am",
    "website": "https://www.sbiam.co.jp",
    "ownerWallet": "0xYourWalletAddress",
    "description": "Nikkei 225 RWA issuer"
  }'
# 201 { id, handle: "sbi_am", status: "pending" }`} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">GET /issuers — query</span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-white/10 text-muted">public</span>
          </div>
          <p className="text-sm text-muted">By handle <code className="text-white/80">GET /issuers?handle=sbi_am</code> or by owner <code className="text-white/80">?ownerWallet=0x...</code> → <code className="text-white/80">{`{handle, issuerName, status, ownerWallet}`}</code>. Also <code className="text-white/80">PATCH /issuers/:id</code> to update website/description/handle (409 if taken, 403 not owner).</p>
          <CodeBlock lang="bash" code={`curl "${BASE}/issuers?handle=sbi_am"
# { handle: "sbi_am", issuerName: "SBI Asset Management", status: "verified" }

curl -X PATCH ${BASE}/issuers/ISSUER_ID \\
  -H "x-platform-api-key: 1122334455667788" \\
  -d '{"website":"https://new.example"}'`} />
        </div>
      </section>

      <section id="listings" className="scroll-mt-24 space-y-6">
        <h2 className="font-display text-xl font-semibold text-white">RWA Token Listings</h2>
        <p className="text-muted text-sm leading-6">Add display metadata to your on-chain <code className="text-white/80">TokenRecord</code> (<code className="text-white/80">POST /tokens</code>) — extra fields <code className="text-white/80">apy tvl desc productUrl</code> for Discover. Strict 1:1 mapping by <code className="text-white/80">tokenAddress+chainId</code>.</p>

        <div className="rounded-xl border border-border bg-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-white">POST /listings — link token</span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/20">verified issuer only</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="font-mono text-xs text-muted break-all">{BASE}/listings</div>
            <div className="text-muted">Body <span className="text-white">issuerProfileId tokenAddress chainId</span> required + display <span className="text-white">apy tvl desc productUrl</span>. 409 if token already has listing, 403 if issuer not verified.</div>
            <CodeBlock lang="bash" title="curl — link token to issuer" code={`curl -X POST ${BASE}/listings \\
  -H "x-platform-api-key: 1122334455667788" \\
  -d '{
    "issuerProfileId": "ISSUER_ID",
    "tokenAddress": "0xYourGTokenAddress",
    "chainId": 11155111,
    "apy": "12.8%",
    "tvl": "$6.4M",
    "desc": "Nikkei 225 RWA — daily NAV attested",
    "productUrl": "https://issuer.example/nikkei-225-rwa"
  }'
# 201 { tokenProfileId, status: "listed" }`} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">PATCH /listings — update · DELETE /listings — remove</span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-white/10 text-muted">owner only</span>
          </div>
          <p className="text-sm text-muted">Update <code className="text-white/80">apy/tvl/desc/productUrl/status listed|draft</code> or delete — <code className="text-white/80">TokenRecord</code> stays on-chain, only display listing removed.</p>
          <CodeBlock lang="bash" code={`curl -X PATCH ${BASE}/listings/TOKEN_PROFILE_ID \\
  -H "x-platform-api-key: 1122334455667788" \\
  -d '{"apy":"13.1%","tvl":"$7M","status":"listed"}'

curl -X DELETE ${BASE}/listings/TOKEN_PROFILE_ID \\
  -H "x-platform-api-key: 1122334455667788"`} />
        </div>
      </section>

      <section id="feed" className="scroll-mt-24 space-y-6">
        <h2 className="font-display text-xl font-semibold text-white">Issuer Announcements</h2>
        <p className="text-muted text-sm leading-6">Verified issuers publish updates to the Discover feed — optionally linked to a listing. Anyone can reply publicly.</p>

        <div className="rounded-xl border border-border bg-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-white">POST /feed — publish</span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/20">verified issuer only</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="font-mono text-xs text-muted break-all">{BASE}/feed</div>
            <div className="text-muted">Body <span className="text-white">issuerProfileId text</span> required, <span className="text-white">tokenProfileId txHash</span> optional (≤500 chars).</div>
            <CodeBlock lang="bash" title="curl — publish" code={`curl -X POST ${BASE}/feed \\
  -H "x-platform-api-key: 1122334455667788" \\
  -d '{
    "issuerProfileId": "ISSUER_ID",
    "tokenProfileId": "TOKEN_PROFILE_ID",
    "text": "Nikkei 225 RWA — daily NAV attested on Creditcoin. GO-NIKKEI 12.8% APY open for JP Tier 10."
  }'
# 201 { id, likesCount: 0 }`} />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white">GET /feed — list · POST /feed/:id/replies</span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-white/10 text-muted">public</span>
          </div>
          <p className="text-sm text-muted"><code className="text-white/80">GET /feed?handle=sbi_am</code> public — lists announcements by issuer. Replies: <code className="text-white/80">POST /feed/:id/replies {"{authorWallet, text}"}</code> public, no platform key.</p>
          <CodeBlock lang="bash" code={`curl "${BASE}/feed?handle=sbi_am"
# { items:[{ text:"Nikkei...", likesCount:0 }], count:1 }

curl -X POST ${BASE}/feed/ANNOUNCEMENT_ID/replies \\
  -H "Content-Type: application/json" \\
  -d '{"authorWallet":"0x...","text":"Added to registry — smooth flow!"}'`} />
        </div>
      </section>

      <section id="networks" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-white">Networks & Contracts</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-panel text-muted text-xs">
              <tr>
                <th className="text-left px-4 py-2 font-normal">Network</th>
                <th className="text-left px-4 py-2 font-normal">Contract</th>
                <th className="text-left px-4 py-2 font-normal">Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs font-mono">
              <tr>
                <td className="px-4 py-2 text-white">Sepolia (Chain ID: 11155111)</td>
                <td className="px-4 py-2 text-muted">GOPass (hub)</td>
                <td className="px-4 py-2 break-all">{GOPASS}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-white">Creditcoin Testnet (Chain ID: 102031)</td>
                <td className="px-4 py-2 text-muted">GOPassRegistry</td>
                <td className="px-4 py-2 break-all">{REGISTRY}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-white">Sepolia (Chain ID: 11155111)</td>
                <td className="px-4 py-2 text-muted">GTokenFactory</td>
                <td className="px-4 py-2 break-all">{FACTORY}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-white">API (prod)</td>
                <td className="px-4 py-2 text-muted">Token API</td>
                <td className="px-4 py-2 break-all">{BASE}/tokens</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">Explorer: Sepolia Etherscan • Creditcoin explorer. You own the token — issuer is the owner, platform covers gas.</p>
      </section>

      <section id="errors" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-white">Errors</h2>
        <div className="space-y-2 text-sm">
          {[
            ["401", "unauthorized: invalid platform api key", "Check x-platform-api-key header"],
            ["400", "issuer must be valid address / name and symbol required", "Bad request body"],
            ["403", "not operator/owner", "Factory operator not set — contact platform"],
            ["500", "could not resolve token address / Owner/ RPC not configured", "Check factory/ RPC / retry with txHash"],
            ["timeout", "Endpoint request timed out (29s Gateway)", "Fixed v3467620 — now returns pending immediately; if old, poll TokenRecord"],
          ].map(([c, m, n]) => (
            <div key={c} className="flex gap-3 rounded-lg border border-border bg-panel px-3 py-2">
              <span className="font-mono text-xs px-2 py-1 rounded bg-white/10 text-white shrink-0">{c}</span>
              <span className="font-mono text-xs text-muted break-all">{m}</span>
              <span className="text-xs text-muted ml-auto hidden sm:block">{n}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="pt-6 border-t border-border flex flex-wrap gap-3 text-sm">
        <a href="https://github.com/tamago-labs/attestgo-project" target="_blank" rel="noopener" className="text-muted hover:text-white">
          GitHub →
        </a>
      </div>
    </div>
  );
}
