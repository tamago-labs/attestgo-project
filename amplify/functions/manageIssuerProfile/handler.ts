import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/manageIssuerProfile";
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
  if (expected && provided !== expected) {
    const hasKey = !!provided;
    if (hasKey) return json(401, { error: "unauthorized: invalid platform api key" });
  }
  const args = event.arguments ?? (event.body ? JSON.parse(event.body) : {});
  const action = String(args.action || (args.issuerProfileId ? "update" : "create")).toLowerCase();
  if (action === "create") {
    const issuerName = String(args.issuerName || "").trim();
    const handle = String(args.handle || "").trim().toLowerCase();
    const website = args.website ? String(args.website).trim() : undefined;
    const description = args.description ? String(args.description).trim() : undefined;
    const logoURI = args.logoURI ? String(args.logoURI).trim() : undefined;
    const ownerWallet = String(args.ownerWallet || "").trim().toLowerCase();
    if (!issuerName || !handle || !ownerWallet) return json(400, { error: "issuerName, handle, ownerWallet required" });
    if (!/^[a-z0-9_]{3,20}$/.test(handle)) return json(400, { error: "handle must be 3-20 chars a-z0-9_" });
    const { data: existing } = await (client.models.RWAIssuerProfile as any).byHandle({ handle });
    if (existing && existing.length > 0) return json(409, { error: "handle already taken" });
    const { data } = await (client.models.RWAIssuerProfile as any).create({ issuerName, handle, website, description, logoURI, ownerWallet, status: "pending" });
    return json(201, data);
  } else {
    const issuerProfileId = String(args.issuerProfileId || args.id || "").trim();
    const callerWallet = String(args.callerWallet || args.ownerWallet || "").trim().toLowerCase();
    if (!issuerProfileId) return json(400, { error: "issuerProfileId required" });
    const { data: existing } = await (client.models.RWAIssuerProfile as any).get({ id: issuerProfileId });
    if (!existing) return json(404, { error: "issuer not found" });
    if (callerWallet && existing.ownerWallet.toLowerCase() !== callerWallet) return json(403, { error: "not owner" });
    const patch: any = {};
    if (args.issuerName) patch.issuerName = String(args.issuerName).trim();
    if (args.website !== undefined) patch.website = args.website ? String(args.website).trim() : null;
    if (args.description !== undefined) patch.description = args.description ? String(args.description).trim() : null;
    if (args.logoURI !== undefined) patch.logoURI = args.logoURI ? String(args.logoURI).trim() : null;
    if (args.handle) {
      const h = String(args.handle).trim().toLowerCase();
      if (!/^[a-z0-9_]{3,20}$/.test(h)) return json(400, { error: "handle invalid" });
      const { data: byHandle } = await (client.models.RWAIssuerProfile as any).byHandle({ handle: h });
      if (byHandle && byHandle.length > 0 && byHandle[0].id !== issuerProfileId) return json(409, { error: "handle taken" });
      patch.handle = h;
    }
    const { data } = await (client.models.RWAIssuerProfile as any).update({ id: issuerProfileId, ...patch });
    return json(200, data);
  }
};
