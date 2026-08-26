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
    const provider = new ethers.JsonRpcProvider(rpc, chainId);
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

    // Predict token address via staticCall to avoid waiting for receipt (API Gateway 29s timeout)
    let predicted: string | undefined;
    try {
      if (isWrapped) {
        predicted = await (factory as any).createWrappedGTokenFor.staticCall(issuer, underlyingAddr, name, symbol, rule, iconURI);
      } else {
        predicted = await (factory as any).createGTokenFor.staticCall(issuer, name, symbol, rule, iconURI);
      }
    } catch (e) {
      console.warn("[createGToken] staticCall predict failed", e);
    }

    let tx: ethers.TransactionResponse;
    if (isWrapped) {
      tx = await (factory as any).createWrappedGTokenFor(issuer, underlyingAddr, name, symbol, rule, iconURI);
    } else {
      tx = await (factory as any).createGTokenFor(issuer, name, symbol, rule, iconURI);
    }

    // Fast path: don't wait for 1 confirmation (would add ~12s and push over API Gateway 29s limit)
    // Use predicted address if available, else fallback to tx hash only
    let tokenAddress = predicted && ethers.isAddress(predicted) ? predicted : undefined;
    let blockNumber = 0;
    let decimals = 18;
    if (isWrapped) {
      try {
        const meta = new ethers.Contract(underlyingAddr, ["function decimals() view returns (uint8)"] as const, provider);
        decimals = Number(await (meta as any).decimals());
      } catch {}
    }

    const issuerLower = issuer.toLowerCase();
    const tokenLower = tokenAddress ? tokenAddress.toLowerCase() : undefined;

    // Persist TokenRecord immediately (pending blockNumber) so listByIssuer works even before mined
    // Do not block response on DB write failure — return txHash regardless
    if (tokenLower) {
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
            blockNumber,
          });
        }
      } catch (e) {
        console.warn("[createGToken] TokenRecord create failed", e);
      }
    } else {
      console.warn("[createGToken] no predicted address, returning txHash only");
    }

    // Fire-and-forget: try to update blockNumber/decimals after mining without blocking response
    // (Lambda will continue briefly after response until API Gateway closes; don't await)
    if (tokenLower) {
      provider
        .waitForTransaction(tx.hash, 1, 25000)
        .then(async (receipt) => {
          if (!receipt || receipt.status !== 1) return;
          blockNumber = receipt.blockNumber;
          // try to resolve real token address from receipt if prediction mismatched
          let realAddr = tokenLower;
          for (const log of (receipt.logs as any[]) || []) {
            try {
              const parsed = (factory as any).interface.parseLog(log);
              if (parsed && parsed.name === "GTokenCreated") {
                realAddr = String(parsed.args[0]).toLowerCase();
                break;
              }
            } catch {}
          }
          try {
            const g = new ethers.Contract(realAddr, GTOKEN_ABI, provider);
            decimals = Number(await (g as any).decimals());
          } catch {}
          // update record if blockNumber was 0 or address differs
          try {
            const { data: rec } = (await (client.models.TokenRecord as any).list({
              filter: { tokenAddress: { eq: realAddr } },
            })) as any;
            const existing = rec?.[0];
            if (existing) {
              await (client.models.TokenRecord as any).update({ id: existing.id, blockNumber, decimals, tokenAddress: realAddr });
            } else if (realAddr !== tokenLower) {
              await (client.models.TokenRecord as any).create({
                tokenAddress: realAddr,
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
                blockNumber,
              });
            }
          } catch (e) {
            console.warn("[createGToken] async update failed", e);
          }
        })
        .catch((e) => console.warn("[createGToken] waitForTransaction failed", e));
    }

    return json(201, {
      tokenAddress: tokenLower || null,
      chainId,
      factoryAddress: factoryAddr.toLowerCase(),
      issuer: issuerLower,
      name,
      symbol,
      decimals,
      underlying: isWrapped ? underlyingAddr.toLowerCase() : ZERO,
      isWrapped,
      txHash: tx.hash,
      blockNumber,
      pending: true,
    });
  } catch (e: any) {
    console.error("[createGToken] err", e);
    const msg = String(e?.reason || e?.message || e).slice(0, 800);
    const code = msg.includes("not operator/owner") ? 403 : 500;
    return json(code, { error: msg });
  }
};
