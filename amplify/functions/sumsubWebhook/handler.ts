import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/sumsubWebhook";
import crypto from "crypto";
import type { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

export const handler = async (event: {
  headers?: Record<string, string>;
  body?: string;
  requestContext?: { http?: { method?: string } };
}) => {
  console.log("[sumsubWebhook] event", JSON.stringify({ headers: event.headers, body: (event.body || "").slice(0, 500) }));
  const secret = env.SUMSUB_SECRET_KEY as unknown as string;
  const body = event.body || "";
  const hdrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(event.headers || {})) hdrs[k.toLowerCase()] = String(v);
  const digest = hdrs["x-payload-digest"] || hdrs["x-payload-digest".toLowerCase()];
  const algoHdrFull = hdrs["x-payload-digest-alg"] || "HMAC_SHA256_HEX";
  console.log("[sumsubWebhook] digest", digest ? digest.slice(0, 12) + "..." : "none", "algo", algoHdrFull);

  // verify HMAC if secret set and digest present (sandbox webhook optional verify)
  if (secret && digest) {
    const expect =
      algoHdrFull === "HMAC_SHA256_HEX"
        ? crypto.createHmac("sha256", secret).update(body).digest("hex")
        : crypto.createHmac("sha256", secret).update(body).digest("hex");
    console.log("[sumsubWebhook] expect", expect.slice(0, 12) + "...");
    if (expect !== digest) {
      console.warn("[sumsubWebhook] bad digest");
      return { statusCode: 401, body: JSON.stringify({ error: "bad digest" }) };
    }
    console.log("[sumsubWebhook] digest ok");
  } else {
    console.log("[sumsubWebhook] skip digest verify", { hasSecret: !!secret, hasDigest: !!digest });
  }

  let payload: {
    type?: string;
    reviewStatus?: string;
    applicantId?: string;
    externalUserId?: string;
    reviewResult?: { reviewAnswer?: string; reviewRejectType?: string };
    applicantType?: string;
  } | null = null;
  try {
    payload = JSON.parse(body);
    console.log("[sumsubWebhook] payload", JSON.stringify(payload).slice(0, 600));
  } catch (e) {
    console.warn("[sumsubWebhook] bad json", e);
    return { statusCode: 400, body: JSON.stringify({ error: "bad json" }) };
  }
  if (!payload) return { statusCode: 400, body: JSON.stringify({ error: "empty" }) };

  // Only handle applicantReviewed
  if (payload.type !== "applicantReviewed" && payload.reviewStatus) {
    // some payloads use reviewStatus directly without type
  }
  const answer = payload.reviewResult?.reviewAnswer;
  const applicantId = payload.applicantId;
  const externalUserId = payload.externalUserId?.toLowerCase();
  console.log("[sumsubWebhook] ids", { applicantId, externalUserId, answer });
  if (!applicantId && !externalUserId) return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: true }) };

  // find UserProfile by applicantId or externalUserId (wallet)
  type ProfileId = { id: string; walletAddress: string };
  let profile: ProfileId | null = null;
  try {
    if (applicantId) {
      console.log("[sumsubWebhook] lookup by applicantId", applicantId);
      const res = await (client.models.UserProfile as unknown as {
        list: (a: unknown) => Promise<{ data: ProfileId[] }>;
      }).list({ filter: { applicantId: { eq: applicantId } } });
      profile = (res.data?.[0] as ProfileId) || null;
      console.log("[sumsubWebhook] by applicantId", profile?.id || "none");
    }
    if (!profile && externalUserId) {
      console.log("[sumsubWebhook] lookup by wallet", externalUserId);
      const res2 = await (client.models.UserProfile as unknown as {
        byWallet: (a: { walletAddress: string }) => Promise<{ data: ProfileId[] }>;
      }).byWallet({ walletAddress: externalUserId });
      profile = (res2.data?.[0] as ProfileId) || null;
      console.log("[sumsubWebhook] byWallet", profile?.id || "none");
      if (!profile) {
        const res3 = await (client.models.UserProfile as unknown as {
          list: (a: unknown) => Promise<{ data: ProfileId[] }>;
        }).list({ filter: { walletAddress: { eq: externalUserId } } });
        profile = (res3.data?.[0] as ProfileId) || null;
        console.log("[sumsubWebhook] by list wallet", profile?.id || "none");
      }
    }
  } catch (e) {
    console.warn("[sumsubWebhook] profile lookup fail", e);
  }

  if (!profile) {
    console.log("[sumsubWebhook] no profile found");
    return { statusCode: 200, body: JSON.stringify({ ok: true, noProfile: true }) };
  }
  console.log("[sumsubWebhook] profile found", profile.id);

  if (answer === "GREEN") {
    console.log("[sumsubWebhook] GREEN");
    // ensure applicantId stored
    if (applicantId) {
      try {
        console.log("[sumsubWebhook] store applicantId", applicantId);
        await (client.models.UserProfile as unknown as { update: (a: unknown) => Promise<unknown> }).update({
          id: profile.id,
          applicantId,
        });
      } catch (e) {
        console.warn("[sumsubWebhook] update fail", e);
      }
    }
    // webhook does not mint on-chain; client will trigger mintPass via polling or future Lambda
    // we just store that review passed - frontend polling will see GREEN via applicant status
    return { statusCode: 200, body: JSON.stringify({ ok: true, green: true }) };
  }
  console.log("[sumsubWebhook] not GREEN", answer);
  return { statusCode: 200, body: JSON.stringify({ ok: true, answer: answer || null }) };
};
