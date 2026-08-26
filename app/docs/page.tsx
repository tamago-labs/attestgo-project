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
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel px-3 py-1 text-xs text-muted">
          <span className="w-2 h-2 rounded-full bg-violet-400" /> Docs
          <span className="text-border">/</span>
          <span className="text-white">v0 — Testnet</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white">AttestGO — The Compliance Layer for Onchain Finance</h1>
        <p className="text-muted max-w-3xl leading-6">
          Verified identity (GO Pass), compliant assets (GToken) and transfer gating — powered by Attestcoin Protocol on Creditcoin. Issue
          native or wrapped compliant ERC20s via <span className="text-white font-mono text-sm">GTokenFactory</span> on behalf of issuers; platform
          pays gas, issuer becomes token owner.
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
          AttestGO mirrors Attestcoin&apos;s privacy-preserving KYC attestations from Sepolia (source chain, hub <code className="text-white/80">GOPass</code>{" "}
          <span className="font-mono text-xs">{GOPASS}</span>) to Creditcoin registry <span className="font-mono text-xs">{REGISTRY}</span> via
          USC proof builder. Apps gate holdings and transfers via <code className="text-white/80">IGOPassEligible.isEligible</code> per token{" "}
          <code className="text-white/80">Rule</code>.
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
          <div className="text-muted">1. Get Sepolia ETH for factory owner (gas payer). 2. Have issuer address ready. 3. Call:</div>
        </div>
        <CodeBlock
          title="curl — native T-Bill for issuer"
          lang="bash"
          code={`curl -X POST ${BASE}/tokens \\
  -H "x-platform-api-key: 1122334455667788" \\
  -H "Content-Type: application/json" \\
  -d '{
    "issuer": "0x3D63Ce608deB81f9436198A93BCC2e8f3D79F56E",
    "name": "USD T-Bill",
    "symbol": "TBILL",
    "minTier": 10,
    "countriesBitmap": "1",
    "iconURI": "https://icons.test/tbill.svg"
  }'
# wrapped: add "underlying": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
# response 201: { tokenAddress, txHash, blockNumber:0, pending:true, chainId:11155111 }`}
        />
        <p className="text-xs text-muted">
          Poll read: <code className="text-white/80">TokenRecord.listByIssuer({`{issuer: "0x...".toLowerCase()}`})</code> via Data apiKey (public read)
          — <code className="text-white/80">blockNumber</code> flips from 0 when mined. Or{" "}
          <code className="text-white/80">GET https://api-sepolia.etherscan.io/api?module=transaction&action=getstatus&txhash=...</code>
        </p>
      </section>

      <section id="auth" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-white">Authentication</h2>
        <p className="text-muted leading-6 text-sm">
          Token API uses separate platform key — <span className="text-white">not</span> the Amplify Data <code className="text-white/80">apiKey</code> in{" "}
          <code className="text-white/80">amplify_outputs.json</code>. Send one of:
        </p>
        <CodeBlock lang="http" code={`x-platform-api-key: 1122334455667788
# aliases accepted: x-api-key, Authorization: Bearer 1122334455667788`} />
        <p className="text-xs text-muted">
          Mis-match → <code className="text-white/80">401 {"{"}error: "unauthorized: invalid platform api key"{"}"}</code>. Data reads (
          <code className="text-white/80">listByIssuer / listByChain</code>) remain public <code className="text-white/80">allow.publicApiKey read</code>.
        </p>
      </section>

      <section id="endpoints" className="scroll-mt-24 space-y-6">
        <h2 className="font-display text-xl font-semibold text-white">Endpoints</h2>

        <div className="rounded-xl border border-border bg-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-white">POST /tokens</span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">prod</span>
          </div>
          <div className="p-4 space-y-3 text-sm">
            <div className="font-mono text-xs text-muted break-all">{BASE}/tokens — alias /createGToken</div>
            <div className="text-muted">
              Body <span className="text-white">issuer</span> (required, address → becomes <code className="text-white/80">GToken.owner()</code>),{" "}
              <span className="text-white">name/symbol</span>, <span className="text-white">minTier</span> 0..255 (default 10),{" "}
              <span className="text-white">countriesBitmap</span> bigint string (US bit0 = &quot;1&quot;, SG &quot;2&quot;, ...),{" "}
              <span className="text-white">iconURI</span>, <span className="text-white">underlying</span> (0x0 native else wrapped ERC20).
            </div>
            <CodeBlock
              lang="json"
              title="Request"
              code={`{
  "issuer": "0x3D63Ce608deB81f9436198A93BCC2e8f3D79F56E",
  "name": "USD T-Bill",
  "symbol": "TBILL",
  "minTier": 10,
  "countriesBitmap": "1",
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
  "txHash": "0x...",
  "blockNumber": 0,
  "pending": true
}`}
            />
            <div className="text-xs text-muted">Success even if <code className="text-white/80">blockNumber:0</code> — tx broadcast, async waiter updates record after 1 conf. Retry safe (dedup by tokenAddress).</div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel p-4 space-y-2">
          <div className="text-sm font-semibold text-white">GET (Data) — TokenRecord</div>
          <p className="text-sm text-muted">
            AppSync Data: <code className="text-white/80">client.models.TokenRecord.listByIssuer({`{issuer: lower}`})</code> and{" "}
            <code className="text-white/80">listByChain({`{chainId:11155111}`})</code> — public read via <code className="text-white/80">amplify_outputs.json</code>{" "}
            apiKey.
          </p>
          <CodeBlock
            lang="ts"
            code={`import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
const client = generateClient<Schema>();
const { data } = await client.models.TokenRecord.listByIssuer({ issuer: "0x3d63...".toLowerCase() });`}
          />
        </div>
      </section>

      <section id="model" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-xl font-semibold text-white">Data model</h2>
        <div className="rounded-xl border border-border bg-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold text-white">TokenRecord</div>
          <div className="p-4 text-xs font-mono leading-6 text-muted">
            <div>tokenAddress: string (lower, indexed)</div>
            <div>chainId: 11155111</div>
            <div>factoryAddress: {FACTORY.toLowerCase()}</div>
            <div>issuer: string (lower, GSI listByIssuer)</div>
            <div>name / symbol / decimals / underlying / isWrapped / iconURI</div>
            <div>ruleMinTier / ruleBitmap (bigint string)</div>
            <div>txHash / blockNumber (0 pending)</div>
            <div>createdAt / updatedAt (auto)</div>
          </div>
        </div>
        <p className="text-xs text-muted">
          GToken Rule: <code className="text-white/80">allowed_group/allowed_sub_group bytes2 0x0000, min_tier u8, is_black_list, countriesBitmap uint256</code>. Check via{" "}
          <code className="text-white/80">GToken.rule()</code> + <code className="text-white/80">eligibleProvider == GOPass</code>.
        </p>
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
                <td className="px-4 py-2 text-white">Sepolia 11155111</td>
                <td className="px-4 py-2 text-muted">GOPass (hub)</td>
                <td className="px-4 py-2 break-all">{GOPASS}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-white">Creditcoin testnet 102031</td>
                <td className="px-4 py-2 text-muted">GOPassRegistry</td>
                <td className="px-4 py-2 break-all">{REGISTRY}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-white">Sepolia</td>
                <td className="px-4 py-2 text-muted">GTokenFactory</td>
                <td className="px-4 py-2 break-all">{FACTORY}</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-white">API</td>
                <td className="px-4 py-2 text-muted">Token API</td>
                <td className="px-4 py-2 break-all">{BASE}/tokens</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          Explorer: Sepolia Etherscan • Creditcoin explorer. Factory owns no tokens — <code className="text-white/80">GToken.owner() == issuer</code> after{" "}
          <code className="text-white/80">transferOwnership</code>. Platform <code className="text-white/80">OWNER_PK</code> pays gas as{" "}
          <code className="text-white/80">operator</code>.
        </p>
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
        <a href="/app" className="text-muted hover:text-white">
          Launch app →
        </a>
        <a href="https://github.com/tamago-labs/attestgo-project" target="_blank" rel="noopener" className="text-muted hover:text-white">
          GitHub →
        </a>
      </div>
    </div>
  );
}
