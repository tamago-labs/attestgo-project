import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/createIssuerProfile";
import type { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(body) };
}

export const handler = async (event: any) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type,x-api-key,authorization", "Access-Control-Allow-Methods": "POST,OPTIONS" }, body: "" };
  let body: any;
  try { body = event.arguments ?? (event.body ? JSON.parse(event.body) : {}); } catch { return json(400, { error: "invalid JSON" }); }
  const issuerName = String(body.issuerName || "").trim();
  const handle = String(body.handle || "").trim().toLowerCase();
  const website = body.website ? String(body.website).trim() : undefined;
  const description = body.description ? String(body.description).trim() : undefined;
  const logoURI = body.logoURI ? String(body.logoURI).trim() : undefined;
  const ownerWallet = String(body.ownerWallet || "").trim().toLowerCase();
  if (!issuerName || !handle || !ownerWallet) return json(400, { error: "issuerName, handle, ownerWallet required" });
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) return json(400, { error: "handle must be 3-20 chars a-z0-9_" });
  try {
    const { data: existing } = await (client.models.RWAIssuerProfile as any).byHandle({ handle });
    if (existing && existing.length > 0) return json(409, { error: "handle already taken" });
    const { data } = await (client.models.RWAIssuerProfile as any).create({ issuerName, handle, website, description, logoURI, ownerWallet, status: "pending" });
    return json(201, data);
  } catch (e: any) {
    return json(500, { error: String(e?.message || e).slice(0, 500) });
  }
};
