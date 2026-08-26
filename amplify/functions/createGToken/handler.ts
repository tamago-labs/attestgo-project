import type { APIGatewayProxyHandler } from "aws-lambda";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/createGToken";
import { ethers } from "ethers";
import type { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

const FACTORY_ABI = [
  "function createGTokenFor(address tokenOwner, string name_, string symbol_, tuple(bytes2 allowed_group,bytes2 allowed_sub_group,uint8 min_tier,uint8 min_sub_tier,bool is_black_list,uint256 countriesBitmap) rule_, string iconURI_) returns (address)",
  "function createWrappedGTokenFor(address tokenOwner, address underlying_, string name_, string symbol_, tuple(bytes2 allowed_group,bytes2 allowed_sub_group,uint8 min_tier,uint8 min_sub_tier,bool is_black_list,uint256 countriesBitmap) rule_, string iconURI_) returns (address)",
] as const;

const GTOKEN_ABI = ["function decimals() view returns (uint8)"] as const;
const ZERO = "0x0000000000000000000000000000000000000000";

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  };
}

export const handler: APIGatewayProxyHandler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,x-api-key,x-platform-api-key,authorization",
        "Access-Control-Allow-Methods": "POST,OPTIONS,GET",
      },
      body: "",
    };
  }

  // separate API key check — not the Amplify Data apiKey
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), String(v || "")]));
  const provided = headers["x-platform-api-key"] || headers["x-api-key"] || headers["authorization"]?.replace(/^Bearer\s+/i, "") || "";
  const expected = (env.PLATFORM_API_KEY as string) || "";
  if (!expected) return json(500, { error: "PLATFORM_API_KEY not configured" });
  if (!provided || provided !== expected) return json(401, { error: "unauthorized: invalid platform api key" });

  if (event.httpMethod !== "POST") return json(405, { error: "method not allowed, use POST" });

  let body: any;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: "invalid JSON body" });
  }

  const issuer: string = String(body.issuer || body.tokenOwner || "").trim();
  const name: string = String(body.name || "").trim();
  const symbol: string = String(body.symbol || "").trim();
  const minTier = Number(body.minTier ?? body.min_tier ?? 10);
  const countriesBitmapStr: string = String(body.countriesBitmap ?? body.bitmap ?? "1");
  const iconURI: string = String(body.iconURI || "https://icons.test/tbill.svg");
  const underlying: string = body.underlying ? String(body.underlying).trim() : ZERO;
  const factoryAddr = (env.FACTORY_ADDR as string) || ZERO;
  const chainId = Number((env.CHAIN_ID as string) || "11155111");

  if (!ethers.isAddress(issuer)) return json(400, { error: "issuer must be valid address" });
  if (!name || !symbol) return json(400, { error: "name and symbol required" });
  if (!Number.isFinite(minTier) || minTier < 0 || minTier > 255) return json(400, { error: "minTier 0..255" });
  let bitmap: bigint;
  try {
    bitmap = BigInt(countriesBitmapStr);
  } catch {
    return json(400, { error: "countriesBitmap must be integer string (bigint)" });
  }
  const underlyingAddr = underlying && underlying !== "" ? underlying : ZERO;
  const isWrapped = underlyingAddr.toLowerCase() !== ZERO.toLowerCase();
  if (isWrapped && !ethers.isAddress(underlyingAddr)) return json(400, { error: "underlying must be address or zero" });

  const rpc = env.SEPOLIA_RPC_URL as string;
  const pk = env.OWNER_PK as string;
  if (!rpc || !pk) return json(500, { error: "SEPOLIA_RPC_URL or OWNER_PK not configured" });

  try {
    const provider = new ethers.JsonRpcProvider(rpc);
    const wallet = new ethers.Wallet(pk, provider);
    const factory = new ethers.Contract(factoryAddr, FACTORY_ABI, wallet);

    const rule = {
      allowed_group: "0x0000",
      allowed_sub_group: "0x0000",
      min_tier: minTier,
      min_sub_tier: 0,
      is_black_list: false,
      countriesBitmap: bitmap,
    } as const;

    let tx: ethers.TransactionResponse;
    if (isWrapped) {
      tx = await (factory as any).createWrappedGTokenFor(issuer, underlyingAddr, name, symbol, rule, iconURI);
    } else {
      tx = await (factory as any).createGTokenFor(issuer, name, symbol, rule, iconURI);
    }
    const receipt = await tx.wait(1);
    if (!receipt) return json(500, { error: "tx failed, no receipt" });

    // extract GToken address from GTokenCreated event or receipt
    let tokenAddress: string | undefined;
    // factory emits GTokenCreated(address token,...) — topic0 indexed token
    for (const log of receipt.logs as any[]) {
      try {
        const parsed = (factory as any).interface.parseLog(log);
        if (parsed && parsed.name === "GTokenCreated") {
          tokenAddress = String(parsed.args[0]);
          break;
        }
      } catch {}
    }
    if (!tokenAddress) {
      // fallback: read from tx response via callStatic? use receipt contractAddress not correct; query factory allTokensLength
      // as last resort, decode from receipt logs address (first log address if single)
      tokenAddress = (receipt.logs[0] as any)?.address || undefined;
    }
    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return json(500, { error: "could not resolve token address from receipt", txHash: tx.hash, blockNumber: receipt.blockNumber });
    }

    // fetch decimals for record (wrapped mirrors underlying else 18)
    let decimals = 18;
    try {
      const g = new ethers.Contract(tokenAddress, GTOKEN_ABI, provider);
      decimals = Number(await (g as any).decimals());
    } catch {}

    const issuerLower = issuer.toLowerCase();
    const tokenLower = tokenAddress.toLowerCase();

    // save to DB — idempotent: check existing by tokenAddress
    // use list filter for idempotency (in case retry)
    try {
      const { data: existing } = (await (client.models.TokenRecord as any).list({
        filter: { tokenAddress: { eq: tokenLower } },
      })) as any;
      if (!existing || existing.length === 0) {
        await (client.models.TokenRecord as any).create({
          tokenAddress: tokenLower,
          chainId,
          factoryAddress: factoryAddr.toLowerCase(),
          issuer: issuerLower,
          name,
          symbol,
          decimals,
          underlying: isWrapped ? underlyingAddr.toLowerCase() : ZERO,
          isWrapped,
          iconURI,
          ruleMinTier: minTier,
          ruleBitmap: bitmap.toString(),
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
        });
      }
    } catch (e) {
      console.warn("[createGToken] TokenRecord create failed", e);
      // still return success — on-chain succeeded
    }

    return json(201, {
      tokenAddress: tokenLower,
      chainId,
      factoryAddress: factoryAddr.toLowerCase(),
      issuer: issuerLower,
      name,
      symbol,
      decimals,
      underlying: isWrapped ? underlyingAddr.toLowerCase() : ZERO,
      isWrapped,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (e: any) {
    console.error("[createGToken] err", e);
    const msg = String(e?.reason || e?.message || e).slice(0, 800);
    const code = msg.includes("not operator/owner") ? 403 : 500;
    return json(code, { error: msg });
  }
};
