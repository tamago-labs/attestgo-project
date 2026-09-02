import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/manageRWATokenProfile";
import type { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) };
}

export const handler = async (event: any) => {
  const args = event.arguments ?? (event.body ? JSON.parse(event.body) : {});
  const action = String(args.action || "").toLowerCase();
  if (action === "delete") {
    const tokenProfileId = String(args.tokenProfileId || args.id || "").trim();
    const callerWallet = args.callerWallet ? String(args.callerWallet).trim().toLowerCase() : undefined;
    if (!tokenProfileId) return json(400, { error: "tokenProfileId required" });
    const { data: existing } = await (client.models.RWATokenProfile as any).get({ id: tokenProfileId });
    if (!existing) return json(404, { error: "profile not found" });
    const { data: issuer } = await (client.models.RWAIssuerProfile as any).get({ id: existing.issuerProfileId });
    if (callerWallet && issuer && issuer.ownerWallet.toLowerCase() !== callerWallet) return json(403, { error: "not issuer owner" });
    await (client.models.RWATokenProfile as any).delete({ id: tokenProfileId });
    return json(200, { deleted: tokenProfileId });
  }
  if (action === "update") {
    const tokenProfileId = String(args.tokenProfileId || args.id || "").trim();
    const callerWallet = args.callerWallet ? String(args.callerWallet).trim().toLowerCase() : undefined;
    if (!tokenProfileId) return json(400, { error: "tokenProfileId required" });
    const { data: existing } = await (client.models.RWATokenProfile as any).get({ id: tokenProfileId });
    if (!existing) return json(404, { error: "profile not found" });
    const { data: issuer } = await (client.models.RWAIssuerProfile as any).get({ id: existing.issuerProfileId });
    if (callerWallet && issuer && issuer.ownerWallet.toLowerCase() !== callerWallet) return json(403, { error: "not issuer owner" });
    const patch: any = {};
    if (args.apy !== undefined) patch.apy = args.apy ? String(args.apy).trim() : null;
    if (args.tvl !== undefined) patch.tvl = args.tvl ? String(args.tvl).trim() : null;
    if (args.desc !== undefined) patch.desc = args.desc ? String(args.desc).trim() : null;
    if (args.productUrl !== undefined) patch.productUrl = args.productUrl ? String(args.productUrl).trim() : null;
    if (args.status) {
      const s = String(args.status).trim();
      if (!["draft", "listed"].includes(s)) return json(400, { error: "status draft|listed" });
      patch.status = s;
    }
    const { data } = await (client.models.RWATokenProfile as any).update({ id: tokenProfileId, ...patch });
    return json(200, data);
  }
  // create
  const issuerProfileId = String(args.issuerProfileId || "").trim();
  const tokenRecordId = String(args.tokenRecordId || "").trim();
  const apy = args.apy ? String(args.apy).trim() : undefined;
  const tvl = args.tvl ? String(args.tvl).trim() : undefined;
  const desc = args.desc ? String(args.desc).trim() : undefined;
  const productUrl = args.productUrl ? String(args.productUrl).trim() : undefined;
  const callerWallet = args.callerWallet ? String(args.callerWallet).trim().toLowerCase() : undefined;
  if (!issuerProfileId || !tokenRecordId) return json(400, { error: "issuerProfileId and tokenRecordId required" });
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
};
