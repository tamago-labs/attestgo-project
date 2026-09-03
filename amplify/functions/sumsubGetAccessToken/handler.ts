import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/sumsubGetAccessToken";
import crypto from "crypto";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

const BASE = (env.SUMSUB_BASE_URL as unknown as string) || "https://api.sumsub.com";
const LEVEL = (env.SUMSUB_LEVEL as unknown as string) || "basic-attestgo";

function sign(ts: string, method: string, url: string, body: string, secret: string) {
  const data = ts + method.toUpperCase() + url + body;
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

type Args = { walletAddress: string; ttlInSecs?: number | null };

export const handler: Schema["sumsubGetAccessToken"]["functionHandler"] = async (event) => {
  const { walletAddress, ttlInSecs } = event.arguments as Args;
  if (!walletAddress) throw new Error("walletAddress required");
  const appToken = env.SUMSUB_APP_TOKEN as unknown as string;
  const secretKey = env.SUMSUB_SECRET_KEY as unknown as string;
  if (!appToken || !secretKey) throw new Error("SUMSUB_APP_TOKEN / SECRET not set (sandbox)");
  const ttl = ttlInSecs && ttlInSecs > 0 ? Math.min(ttlInSecs, 1200) : 600;

  const externalUserId = walletAddress.toLowerCase();
  console.log("[sumsubGetAccessToken] start", { externalUserId, ttl });
  // resolve applicantId from UserProfile
  let applicantId: string | null = null;
  try {
    console.log("[sumsubGetAccessToken] byWallet lookup");
    const res = await (client.models.UserProfile as unknown as {
      byWallet: (a: { walletAddress: string }) => Promise<{ data: { applicantId?: string | null }[] }>;
    }).byWallet({ walletAddress: externalUserId });
    applicantId = res.data?.[0]?.applicantId || null;
    console.log("[sumsubGetAccessToken] byWallet", applicantId);
    if (!applicantId) {
      console.log("[sumsubGetAccessToken] fallback list");
      const res2 = await (client.models.UserProfile as unknown as {
        list: (a: unknown) => Promise<{ data: { applicantId?: string | null }[] }>;
      }).list({ filter: { walletAddress: { eq: externalUserId } } });
      applicantId = res2.data?.[0]?.applicantId || null;
      console.log("[sumsubGetAccessToken] list", applicantId);
    }
  } catch (e) {
    console.warn("[sumsubGetAccessToken] profile lookup fail", e);
  }

  // if no applicantId, create via Sumsub lookup by externalUserId then fallback to createApplicant mutation reuse
  // request SDK token: POST /resources/accessTokens?userId={externalUserId}&levelName=...&ttlInSecs=
  // Sumsub allows userId = externalUserId prefixed with _ ; but we prefer applicantId if known else externalUserId
  const userId = applicantId || externalUserId;
  console.log("[sumsubGetAccessToken] userId for token", userId);
  // body must be empty string for signing per docs for accessTokens with query params and no body
  const path = `/resources/accessTokens?userId=${encodeURIComponent(userId)}&levelName=${encodeURIComponent(LEVEL)}&ttlInSecs=${ttl}`;
  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = sign(ts, "POST", path, "", secretKey);
  console.log("[sumsubGetAccessToken] POST", path);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "X-App-Token": appToken,
      "X-App-Access-Ts": ts,
      "X-App-Access-Sig": sig,
    },
  });
  const text = await res.text();
  console.log("[sumsubGetAccessToken] status", res.status, text.slice(0, 400));
  let json: { token?: string; userId?: string } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok || !json?.token) throw new Error(`Sumsub token failed ${res.status}: ${text.slice(0, 400)}`);
  console.log("[sumsubGetAccessToken] ok", json.userId);
  return { token: json.token, userId: json.userId || userId, levelName: LEVEL, ttlInSecs: ttl } as unknown as string;
};
