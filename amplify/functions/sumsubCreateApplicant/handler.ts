import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/sumsubCreateApplicant";
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

type Args = { walletAddress: string };

export const handler: Schema["sumsubCreateApplicant"]["functionHandler"] = async (event) => {
  const { walletAddress } = event.arguments as Args;
  if (!walletAddress) throw new Error("walletAddress required");
  const externalUserId = walletAddress.toLowerCase();
  const appToken = env.SUMSUB_APP_TOKEN as unknown as string;
  const secretKey = env.SUMSUB_SECRET_KEY as unknown as string;
  if (!appToken || !secretKey) throw new Error("SUMSUB_APP_TOKEN / SECRET not set (sandbox)");

  // load profile to get displayName/country and existing applicantId
  type ProfileRow = { id: string; displayName?: string; country?: string; applicantId?: string | null };
  let profile: ProfileRow | null = null;
  console.log("[sumsubCreateApplicant] start", { externalUserId, level: LEVEL });
  try {
    console.log("[sumsubCreateApplicant] byWallet lookup", externalUserId);
    const res = await (client.models.UserProfile as unknown as {
      byWallet: (a: { walletAddress: string }) => Promise<{ data: ProfileRow[] }>;
    }).byWallet({ walletAddress: externalUserId });
    console.log("[sumsubCreateApplicant] byWallet res", JSON.stringify(res.data?.[0] || null).slice(0, 400));
    const viaByWallet = res.data?.[0];
    if (viaByWallet) profile = viaByWallet as ProfileRow;
    else {
      console.log("[sumsubCreateApplicant] fallback list filter");
      const res2 = await (client.models.UserProfile as unknown as {
        list: (a: unknown) => Promise<{ data: ProfileRow[] }>;
      }).list({ filter: { walletAddress: { eq: externalUserId } } });
      console.log("[sumsubCreateApplicant] list res", JSON.stringify(res2.data?.[0] || null).slice(0, 400));
      profile = (res2.data?.[0] as ProfileRow) || null;
    }
  } catch (e) {
    console.warn("[sumsubCreateApplicant] profile lookup fail", e);
  }
  console.log("[sumsubCreateApplicant] profile", profile ? { id: profile.id, applicantId: profile.applicantId } : null);
  if (!profile) throw new Error("UserProfile not found — create profile in Settings first");

  if (profile.applicantId) {
    // verify it still exists in Sumsub, else recreate
    console.log("[sumsubCreateApplicant] check existing applicantId", profile.applicantId);
    try {
      const ts = Math.floor(Date.now() / 1000).toString();
      const url = `/resources/applicants/${profile.applicantId}/one`;
      const sig = sign(ts, "GET", url, "", secretKey);
      console.log("[sumsubCreateApplicant] GET", url);
      const r = await fetch(`${BASE}${url}`, {
        method: "GET",
        headers: {
          "X-App-Token": appToken,
          "X-App-Access-Ts": ts,
          "X-App-Access-Sig": sig,
        },
      });
      console.log("[sumsubCreateApplicant] GET status", r.status);
      if (r.ok) {
        const j = await r.json();
        console.log("[sumsubCreateApplicant] GET ok", JSON.stringify(j).slice(0, 300));
        return JSON.stringify({ applicantId: (j as { id?: string }).id || profile.applicantId, externalUserId, levelName: LEVEL, reused: true });
      } else {
        console.warn("[sumsubCreateApplicant] GET not ok", await r.text().then((t) => t.slice(0, 300)));
      }
    } catch (e) {
      console.warn("[sumsubCreateApplicant] GET applicant fail", e);
    }
  }

  // try get by externalUserId before creating (Sumsub 409 on duplicate)
  console.log("[sumsubCreateApplicant] try GET by externalUserId");
  try {
    const ts = Math.floor(Date.now() / 1000).toString();
    const url = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;
    const sig = sign(ts, "GET", url, "", secretKey);
    console.log("[sumsubCreateApplicant] GET externalUserId", url);
    const r = await fetch(`${BASE}${url}`, {
      method: "GET",
      headers: {
        "X-App-Token": appToken,
        "X-App-Access-Ts": ts,
        "X-App-Access-Sig": sig,
      },
    });
    console.log("[sumsubCreateApplicant] GET externalUserId status", r.status);
    if (r.ok) {
      const j = (await r.json()) as { id: string };
      console.log("[sumsubCreateApplicant] GET externalUserId ok", j.id);
      if (j.id) {
        try {
          await (client.models.UserProfile as unknown as { update: (a: unknown) => Promise<unknown> }).update({
            id: profile.id,
            applicantId: j.id,
          });
        } catch (e) {
          console.warn("[sumsubCreateApplicant] update profile fail", e);
        }
        return JSON.stringify({ applicantId: j.id, externalUserId, levelName: LEVEL, reused: true });
      }
    } else {
      console.log("[sumsubCreateApplicant] GET externalUserId no hit", await r.text().then((t) => t.slice(0, 300)));
    }
  } catch (e) {
    console.warn("[sumsubCreateApplicant] GET externalUserId fail", e);
  }

  // create applicant
  console.log("[sumsubCreateApplicant] POST create", LEVEL);
  const bodyObj = { externalUserId };
  const body = JSON.stringify(bodyObj);
  const ts = Math.floor(Date.now() / 1000).toString();
  const path = `/resources/applicants?levelName=${encodeURIComponent(LEVEL)}`;
  const sig = sign(ts, "POST", path, body, secretKey);
  console.log("[sumsubCreateApplicant] POST", path, body);
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "X-App-Token": appToken,
      "X-App-Access-Ts": ts,
      "X-App-Access-Sig": sig,
      "Content-Type": "application/json",
    },
    body,
  });
  const text = await res.text();
  console.log("[sumsubCreateApplicant] POST status", res.status, text.slice(0, 400));
  let json: { id?: string; externalUserId?: string } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok) {
    // 409 duplicate -> parse id
    if (res.status === 409 && json && (json as { id?: string }).id) {
      const dupId = (json as { id: string }).id;
      console.log("[sumsubCreateApplicant] 409 dup", dupId);
      try {
        await (client.models.UserProfile as unknown as { update: (a: unknown) => Promise<unknown> }).update({
          id: profile.id,
          applicantId: dupId,
        });
      } catch (e) {
        console.warn("[sumsubCreateApplicant] update dup fail", e);
      }
      return JSON.stringify({ applicantId: dupId, externalUserId, levelName: LEVEL, reused: true });
    }
    throw new Error(`Sumsub create failed ${res.status}: ${text.slice(0, 400)}`);
  }
  const applicantId = (json as { id: string })?.id;
  if (!applicantId) throw new Error(`Sumsub no id: ${text.slice(0, 400)}`);
  console.log("[sumsubCreateApplicant] created", applicantId);
  try {
    await (client.models.UserProfile as unknown as { update: (a: unknown) => Promise<unknown> }).update({
      id: profile.id,
      applicantId,
    });
  } catch (e) {
    console.warn("[sumsubCreateApplicant] update new fail", e);
  }
  return JSON.stringify({ applicantId, externalUserId, levelName: LEVEL, reused: false });
};
