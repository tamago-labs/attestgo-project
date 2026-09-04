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
  const method = String(event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
  const qs = event.queryStringParameters || event.queryParameters || {};
  const pathParams = event.pathParameters || {};
  if (method === "OPTIONS") return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,x-api-key,x-platform-api-key,authorization", "Access-Control-Allow-Methods": "POST,GET,PATCH,DELETE,OPTIONS" }, body: "" };
  if (method === "GET") {
    const idQ = String(pathParams.id || qs.id || "").trim();
    if (idQ) {
      const { data } = await (client.models.RWATokenProfile as any).get({ id: idQ });
      if (!data) return json(404, { error: "profile not found" });
      return json(200, data);
    }
    const issuerQ = String(qs.issuerProfileId || qs.issuer || "").trim();
    const tokenRecordQ = String(qs.tokenRecordId || qs.tokenAddress || "").trim();
    if (issuerQ) {
      const { data } = await (client.models.RWATokenProfile as any).listByIssuerProfile({ issuerProfileId: issuerQ });
      return json(200, { items: data || [], count: (data || []).length });
    }
    if (tokenRecordQ) {
      // if looks like address, try lookup TokenRecord first then profile
      const { data } = await (client.models.RWATokenProfile as any).byTokenRecordId({ tokenRecordId: tokenRecordQ });
      return json(200, { items: data || [], count: (data || []).length });
    }
    const { data } = await (client.models.RWATokenProfile as any).list({ limit: 50 });
    return json(200, { items: data || [], count: (data || []).length });
  }
  const headers = Object.fromEntries(Object.entries((event.headers || event.request?.headers || {}) as any).map(([k, v]) => [k.toLowerCase(), String(v || "")]));
  const provided = headers["x-platform-api-key"] || headers["x-api-key"] || String(event.arguments?.platformKey || event.arguments?.platformApiKey || "");
  const expected = (env as any).PLATFORM_API_KEY as string;
  if (expected && provided && provided !== expected) return json(401, { error: "unauthorized: invalid platform api key" });
  // support PATCH /listings/{id} and DELETE /listings/{id} via path param
  const rawArgs = event.arguments ?? (event.body ? JSON.parse(event.body) : {});
  const pathId = String(pathParams.id || "").trim();
  // tokenAddress+chainId alias: resolve TokenRecord -> tokenRecordId for docs contract POST /listings
  let tokenRecordIdAlias: string | undefined;
  if (rawArgs.tokenAddress && !rawArgs.tokenRecordId) {
    const addr = String(rawArgs.tokenAddress).trim().toLowerCase();
    const chainIdQ = Number(rawArgs.chainId || 11155111);
    try {
      const { data: recs } = await (client.models.TokenRecord as any).list({ filter: { tokenAddress: { eq: addr }, chainId: { eq: chainIdQ } } });
      if (recs && recs.length > 0) tokenRecordIdAlias = recs[0].id;
    } catch {}
  }
  const args = pathId ? { ...rawArgs, tokenProfileId: rawArgs.tokenProfileId || pathId, id: pathId, tokenRecordId: rawArgs.tokenRecordId || tokenRecordIdAlias } : { ...rawArgs, tokenRecordId: rawArgs.tokenRecordId || tokenRecordIdAlias };
  const isPatch = method === "PATCH";
  const isDelete = method === "DELETE";
  const action = String(args.action || (isDelete ? "delete" : isPatch ? "update" : "")).toLowerCase();
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
