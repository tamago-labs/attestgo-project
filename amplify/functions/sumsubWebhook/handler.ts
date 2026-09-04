import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/sumsubWebhook";
import crypto from "crypto";
import type { Schema } from "../../data/resource";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env as unknown as Parameters<typeof getAmplifyDataClientConfig>[0]);
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

  // verify HMAC if secret set and digest present
  if (secret && digest) {
    const algoMap: Record<string, string> = { HMAC_SHA1_HEX: "sha1", HMAC_SHA256_HEX: "sha256", HMAC_SHA512_HEX: "sha512" };
    const algo = algoMap[algoHdrFull] || "sha256";
    const expect = crypto.createHmac(algo, secret).update(body).digest("hex");
    console.log("[sumsubWebhook] expect", expect.slice(0, 12) + "...", "algo", algo);
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
    testMode?: boolean;
  } | null = null;
  try {
    payload = JSON.parse(body);
    console.log("[sumsubWebhook] payload", JSON.stringify(payload).slice(0, 600));
  } catch (e) {
    console.warn("[sumsubWebhook] bad json", e);
    return { statusCode: 400, body: JSON.stringify({ error: "bad json" }) };
  }
  if (!payload) return { statusCode: 400, body: JSON.stringify({ error: "empty" }) };
  if (payload.testMode) {
    console.log("[sumsubWebhook] testMode ignore");
    return { statusCode: 200, body: JSON.stringify({ ok: true, testMode: true }) };
  }

  // Only handle applicantReviewed for User Verification
  if (payload.type && payload.type !== "applicantReviewed") {
    console.log("[sumsubWebhook] ignore type", payload.type);
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignoredType: payload.type }) };
  }
  const answer = payload.reviewResult?.reviewAnswer;
  const rejectType = payload.reviewResult?.reviewRejectType;
  const applicantId = payload.applicantId;
  const externalUserId = payload.externalUserId?.toLowerCase();
  console.log("[sumsubWebhook] ids", { applicantId, externalUserId, answer, rejectType });
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
    console.log("[sumsubWebhook] no profile found — fallback scan for pending");
    try {
      // fallback: webhook externalUserId may be random (old flow); look for most recent pending profile and link
      const all = await (client.models.UserProfile as unknown as { list: (a: unknown) => Promise<{ data: (ProfileId & { kycStatus?: string | null; updatedAt?: string })[] }> }).list({});
      const pending = all.data?.filter((p) => !p.walletAddress.includes(":") ) || [];
      // prefer pending/ init with no green/red
      const cand = pending.filter((p) => !p.walletAddress.startsWith("0x") === false).slice(0, 20);
      console.log("[sumsubWebhook] fallback candidates", cand.length);
      // try to find profile that recently requested token (kycStatus pending/init) — take first pending
      const fallback = all.data?.find((p) => (p as unknown as { kycStatus?: string }).kycStatus === "pending" || (p as unknown as { kycStatus?: string }).kycStatus === "init" || !(p as unknown as { kycStatus?: string }).kycStatus);
      if (fallback) {
        profile = { id: fallback.id, walletAddress: fallback.walletAddress } as ProfileId;
        console.log("[sumsubWebhook] fallback linked", profile.id, profile.walletAddress);
      }
    } catch (e) {
      console.warn("[sumsubWebhook] fallback fail", e);
    }
    if (!profile) {
      console.log("[sumsubWebhook] still no profile");
      return { statusCode: 200, body: JSON.stringify({ ok: true, noProfile: true }) };
    }
  }
  console.log("[sumsubWebhook] profile found", profile.id);

  const kycStatus = answer === "GREEN" ? "green" : answer === "RED" ? "red" : "pending";
  const kycReviewAnswer = answer || null;
  const kycRejectType = rejectType || null;
  console.log("[sumsubWebhook] persist", { kycStatus, kycReviewAnswer, kycRejectType });
  try {
    const update: Record<string, unknown> = {
      id: profile.id,
      kycStatus,
      kycReviewAnswer,
      kycRejectType,
    };
    if (applicantId) update.applicantId = applicantId;
    console.log("[sumsubWebhook] update profile", update);
    await (client.models.UserProfile as unknown as { update: (a: unknown) => Promise<unknown> }).update(update);
  } catch (e) {
    console.warn("[sumsubWebhook] update fail", e);
  }
  if (answer === "GREEN") {
    console.log("[sumsubWebhook] GREEN persisted");
    return { statusCode: 200, body: JSON.stringify({ ok: true, green: true }) };
  }
  console.log("[sumsubWebhook] not GREEN", answer);
  return { statusCode: 200, body: JSON.stringify({ ok: true, answer: answer || null, kycStatus }) };
};
