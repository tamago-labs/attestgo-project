import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/deleteRWATokenProfile";
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
  const tokenProfileId = String(body.tokenProfileId || body.id || "").trim();
  const callerWallet = body.callerWallet ? String(body.callerWallet).trim().toLowerCase() : undefined;
  if (!tokenProfileId) return json(400, { error: "tokenProfileId required" });
  try {
    const { data: existing } = await (client.models.RWATokenProfile as any).get({ id: tokenProfileId });
    if (!existing) return json(404, { error: "profile not found" });
    const { data: issuer } = await (client.models.RWAIssuerProfile as any).get({ id: existing.issuerProfileId });
    if (callerWallet && issuer && issuer.ownerWallet.toLowerCase() !== callerWallet) return json(403, { error: "not issuer owner" });
    await (client.models.RWATokenProfile as any).delete({ id: tokenProfileId });
    return json(200, { deleted: tokenProfileId });
  } catch (e: any) {
    return json(500, { error: String(e?.message || e).slice(0, 500) });
  }
};
