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
  const method = String(event.httpMethod || event.requestContext?.http?.method || "").toUpperCase();
  const qs = event.queryStringParameters || event.queryParameters || {};
  const pathParams = event.pathParameters || {};
  const path = String(event.path || event.requestContext?.http?.path || "");
  if (method === "OPTIONS") return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,x-api-key,x-platform-api-key,authorization", "Access-Control-Allow-Methods": "POST,GET,OPTIONS" }, body: "" };
  // GET /feed?handle= or ?issuerProfileId= or GET /feed/{id}/replies -> list replies
  if (method === "GET") {
    const isReplies = path.includes("/replies") || String(qs.replies || "") === "1" || !!pathParams.id && String(event.resource || "").includes("replies");
    const announcementId = String(pathParams.id || qs.announcementId || qs.id || "").trim();
    // detect /feed/{id}/replies via path: /feed/xxx/replies
    const pathMatch = path.match(/\/feed\/([^/]+)\/replies/);
    const replyId = pathMatch ? pathMatch[1] : announcementId;
    if (path.includes("/replies") || (replyId && isReplies)) {
      const aid = replyId || announcementId;
      if (!aid) return json(400, { error: "announcementId required" });
      const { data } = await (client.models.AnnouncementReply as any).listByAnnouncement({ announcementId: aid });
      return json(200, { items: data || [], count: (data || []).length });
    }
    const issuerIdQ = String(qs.issuerProfileId || "").trim();
    const handleQ = String(qs.handle || "").trim().toLowerCase();
    if (handleQ) {
      const { data: issuers } = await (client.models.RWAIssuerProfile as any).byHandle({ handle: handleQ });
      const issuer = issuers?.[0];
      if (!issuer) return json(404, { error: "issuer not found" });
      const { data } = await (client.models.IssuerAnnouncement as any).listByIssuerAnnouncement({ issuerProfileId: issuer.id });
      return json(200, { items: data || [], count: (data || []).length, issuer });
    }
    if (issuerIdQ) {
      const { data } = await (client.models.IssuerAnnouncement as any).listByIssuerAnnouncement({ issuerProfileId: issuerIdQ });
      return json(200, { items: data || [], count: (data || []).length });
    }
    const { data } = await (client.models.IssuerAnnouncement as any).list({ limit: 50 });
    return json(200, { items: data || [], count: (data || []).length });
  }
  // POST /feed/{id}/replies
  const isReplyPost = path.includes("/replies") || String(pathParams.id || "").trim() && method === "POST" && String(event.body || "").includes("authorWallet") && !JSON.parse(event.body || "{}").issuerProfileId;
  // detect via path /feed/{id}/replies
  const replyPathMatch = path.match(/\/feed\/([^/]+)\/replies/);
  if (replyPathMatch || (path.includes("/replies") && method === "POST")) {
    const announcementId = replyPathMatch ? replyPathMatch[1] : String(pathParams.id || "").trim();
    let b: any;
    try { b = event.arguments ?? (event.body ? JSON.parse(event.body) : {}); } catch { return json(400, { error: "invalid JSON" }); }
    const authorWallet = String(b.authorWallet || "").trim().toLowerCase();
    const text = String(b.text || "").trim();
    if (!announcementId || !authorWallet || !text) return json(400, { error: "announcementId, authorWallet, text required" });
    if (text.length > 500) return json(400, { error: "text max 500" });
    const { data: ann } = await (client.models.IssuerAnnouncement as any).get({ id: announcementId });
    if (!ann) return json(404, { error: "announcement not found" });
    const { data } = await (client.models.AnnouncementReply as any).create({ announcementId, authorWallet, text });
    return json(201, data);
  }
  // POST /feed or /announcements create announcement
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
