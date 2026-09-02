import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/postAnnouncement";
import type { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) };
}

export const handler = async (event: any) => {
  const headers = Object.fromEntries(Object.entries((event.headers || event.request?.headers || {}) as any).map(([k, v]) => [k.toLowerCase(), String(v || "")]));
  const provided = headers["x-platform-api-key"] || headers["x-api-key"] || String(event.arguments?.platformKey || event.arguments?.platformApiKey || "");
  const expected = (env as any).PLATFORM_API_KEY as string;
  if (expected && provided && provided !== expected) return json(401, { error: "unauthorized: invalid platform api key" });
  let body: any;
  try { body = event.arguments ?? (event.body ? JSON.parse(event.body) : {}); } catch { return json(400, { error: "invalid JSON" }); }
  const issuerProfileId = String(body.issuerProfileId || "").trim();
  const text = String(body.text || "").trim();
  const tokenProfileId = body.tokenProfileId ? String(body.tokenProfileId).trim() : undefined;
  const txHash = body.txHash ? String(body.txHash).trim() : undefined;
  const callerWallet = body.callerWallet ? String(body.callerWallet).trim().toLowerCase() : undefined;
  if (!issuerProfileId || !text) return json(400, { error: "issuerProfileId and text required" });
  if (text.length > 500) return json(400, { error: "text max 500 chars" });
  try {
    const { data: issuer } = await (client.models.RWAIssuerProfile as any).get({ id: issuerProfileId });
    if (!issuer) return json(404, { error: "issuer not found" });
    if (issuer.status !== "verified") return json(403, { error: "issuer not verified" });
    if (callerWallet && issuer.ownerWallet.toLowerCase() !== callerWallet) return json(403, { error: "not issuer owner" });
    if (tokenProfileId) {
      const { data: tp } = await (client.models.RWATokenProfile as any).get({ id: tokenProfileId });
      if (!tp || tp.issuerProfileId !== issuerProfileId) return json(400, { error: "tokenProfile not in issuer" });
    }
    const { data } = await (client.models.IssuerAnnouncement as any).create({ issuerProfileId, tokenProfileId, text, txHash, likesCount: 0 });
    return json(201, data);
  } catch (e: any) {
    return json(500, { error: String(e?.message || e).slice(0, 500) });
  }
};
