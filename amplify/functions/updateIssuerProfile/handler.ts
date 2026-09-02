import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/updateIssuerProfile";
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
  const issuerProfileId = String(body.issuerProfileId || body.id || "").trim();
  const callerWallet = String(body.callerWallet || body.ownerWallet || "").trim().toLowerCase();
  if (!issuerProfileId) return json(400, { error: "issuerProfileId required" });
  try {
    const { data: existing } = await (client.models.RWAIssuerProfile as any).get({ id: issuerProfileId });
    if (!existing) return json(404, { error: "issuer not found" });
    if (callerWallet && existing.ownerWallet.toLowerCase() !== callerWallet) return json(403, { error: "not owner" });
    const patch: any = {};
    if (body.issuerName) patch.issuerName = String(body.issuerName).trim();
    if (body.website !== undefined) patch.website = body.website ? String(body.website).trim() : null;
    if (body.description !== undefined) patch.description = body.description ? String(body.description).trim() : null;
    if (body.logoURI !== undefined) patch.logoURI = body.logoURI ? String(body.logoURI).trim() : null;
    if (body.handle) {
      const h = String(body.handle).trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(h)) return json(400, { error: "handle invalid" });
      const { data: byHandle } = await (client.models.RWAIssuerProfile as any).byHandle({ handle: h });
      if (byHandle && byHandle.length > 0 && byHandle[0].id !== issuerProfileId) return json(409, { error: "handle taken" });
      patch.handle = h;
    }
    const { data } = await (client.models.RWAIssuerProfile as any).update({ id: issuerProfileId, ...patch });
    return json(200, data);
  } catch (e: any) {
    return json(500, { error: String(e?.message || e).slice(0, 500) });
  }
};
