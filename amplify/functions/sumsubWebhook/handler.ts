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
  const secret = env.SUMSUB_SECRET_KEY as unknown as string;
  const body = event.body || "";
  const hdrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(event.headers || {})) hdrs[k.toLowerCase()] = String(v);
  const digest = hdrs["x-payload-digest"] || hdrs["x-payload-digest".toLowerCase()];
  const algoHdrFull = hdrs["x-payload-digest-alg"] || "HMAC_SHA256_HEX";

  // verify HMAC if secret set and digest present (sandbox webhook optional verify)
  if (secret && digest) {
    const expect =
      algoHdrFull === "HMAC_SHA256_HEX"
        ? crypto.createHmac("sha256", secret).update(body).digest("hex")
        : crypto.createHmac("sha256", secret).update(body).digest("hex");
    if (expect !== digest) {
      return { statusCode: 401, body: JSON.stringify({ error: "bad digest" }) };
    }
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
  } catch {
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
  if (!applicantId && !externalUserId) return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: true }) };

  // find UserProfile by applicantId or externalUserId (wallet)
  let profile: { id: string; walletAddress: string } | null = null;
  try {
    if (applicantId) {
      const res = await (client.models.UserProfile as unknown as {
        list: (a: unknown) => Promise<{ data: { id: string; walletAddress: string; applicantId?: string }[] }>;
      }).list({ filter: { applicantId: { eq: applicantId } } });
      profile = (res.data?.[0] as unknown as typeof profile) || null;
    }
    if (!profile && externalUserId) {
      const res2 = await (client.models.UserProfile as unknown as {
        byWallet: (a: { walletAddress: string }) => Promise<{ data: { id: string; walletAddress: string }[] }>;
      }).byWallet({ walletAddress: externalUserId });
      profile = (res2.data?.[0] as unknown as typeof profile) || null;
      if (!profile) {
        const res3 = await (client.models.UserProfile as unknown as {
          list: (a: unknown) => Promise<{ data: typeof profile[] }>;
        }).list({ filter: { walletAddress: { eq: externalUserId } } });
        profile = (res3.data?.[0] as unknown as typeof profile) || null;
      }
    }
  } catch {}

  if (!profile) return { statusCode: 200, body: JSON.stringify({ ok: true, noProfile: true }) };

  if (answer === "GREEN") {
    // ensure applicantId stored
    if (applicantId) {
      try {
        await (client.models.UserProfile as unknown as { update: (a: unknown) => Promise<unknown> }).update({
          id: profile.id,
          applicantId,
        });
      } catch {}
    }
    // webhook does not mint on-chain; client will trigger mintPass via polling or future Lambda
    // we just store that review passed - frontend polling will see GREEN via applicant status
    return { statusCode: 200, body: JSON.stringify({ ok: true, green: true }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, answer: answer || null }) };
};
