import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/createRWATokenProfile";
import type { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) };
}

export const handler = async (event: any) => {
  let body: any;
  try { body = event.arguments ?? (event.body ? JSON.parse(event.body) : {}); } catch { return json(400, { error: "invalid JSON" }); }
  const issuerProfileId = String(body.issuerProfileId || "").trim();
  const tokenRecordId = String(body.tokenRecordId || "").trim();
  const apy = body.apy ? String(body.apy).trim() : undefined;
  const tvl = body.tvl ? String(body.tvl).trim() : undefined;
  const desc = body.desc ? String(body.desc).trim() : undefined;
  const productUrl = body.productUrl ? String(body.productUrl).trim() : undefined;
  const callerWallet = body.callerWallet ? String(body.callerWallet).trim().toLowerCase() : undefined;
  if (!issuerProfileId || !tokenRecordId) return json(400, { error: "issuerProfileId and tokenRecordId required" });
  try {
    const { data: issuer } = await (client.models.RWAIssuerProfile as any).get({ id: issuerProfileId });
    if (!issuer) return json(404, { error: "issuer not found" });
    if (issuer.status !== "verified") return json(403, { error: "issuer not verified" });
    if (callerWallet && issuer.ownerWallet.toLowerCase() !== callerWallet) return json(403, { error: "not issuer owner" });
    const { data: token } = await (client.models.TokenRecord as any).get({ id: tokenRecordId });
    if (!token) return json(404, { error: "TokenRecord not found" });
    const { data: existing } = await (client.models.RWATokenProfile as any).byTokenRecordId({ tokenRecordId });
    if (existing && existing.length > 0) return json(409, { error: "token already has profile" });
    const { data } = await (client.models.RWATokenProfile as any).create({ issuerProfileId, tokenRecordId, apy, tvl, desc, productUrl, status: "listed" });
    return json(201, data);
  } catch (e: any) {
    return json(500, { error: String(e?.message || e).slice(0, 500) });
  }
};
