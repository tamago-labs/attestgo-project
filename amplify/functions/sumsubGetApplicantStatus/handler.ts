import type { Schema } from "../../data/resource";
import { Amplify } from "aws-amplify";
import { getAmplifyDataClientConfig } from "@aws-amplify/backend/function/runtime";
import { generateClient } from "aws-amplify/data";
import { env } from "$amplify/env/sumsubGetApplicantStatus";
import crypto from "crypto";

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const client = generateClient<Schema>();

const BASE = (env.SUMSUB_BASE_URL as unknown as string) || "https://api.sumsub.com";

function sign(ts: string, method: string, url: string, body: string, secret: string) {
  const data = ts + method.toUpperCase() + url + body;
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

type Args = { walletAddress: string };

export const handler: Schema["sumsubGetApplicantStatus"]["functionHandler"] = async (event) => {
  const { walletAddress } = event.arguments as Args;
  if (!walletAddress) throw new Error("walletAddress required");
  const appToken = env.SUMSUB_APP_TOKEN as unknown as string;
  const secretKey = env.SUMSUB_SECRET_KEY as unknown as string;
  if (!appToken || !secretKey) throw new Error("SUMSUB_APP_TOKEN / SECRET not set");
  const externalUserId = walletAddress.toLowerCase();

  let applicantId: string | null = null;
  let kycStatus: string | null = null;
  let kycReviewAnswer: string | null = null;
  try {
    const res = await (client.models.UserProfile as unknown as { byWallet: (a: { walletAddress: string }) => Promise<{ data: { id: string; applicantId?: string | null; kycStatus?: string | null }[] }> }).byWallet({ walletAddress: externalUserId });
    const row = res.data?.[0];
    applicantId = row?.applicantId || null;
    kycStatus = row?.kycStatus || null;
  } catch {}

  if (!applicantId) {
    try {
      const r2 = await (client.models.UserProfile as unknown as { list: (a: unknown) => Promise<{ data: { applicantId?: string | null }[] }> }).list({ filter: { walletAddress: { eq: externalUserId } } });
      applicantId = r2.data?.[0]?.applicantId || null;
    } catch {}
  }

  // prefer lookup by applicantId, else by externalUserId
  const lookupId = applicantId;
  let url = "";
  if (lookupId) url = `/resources/applicants/${lookupId}/one`;
  else url = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;

  const ts = Math.floor(Date.now() / 1000).toString();
  const sig = sign(ts, "GET", url, "", secretKey);
  console.log("[sumsubGetApplicantStatus] GET", url);
  const res = await fetch(`${BASE}${url}`, {
    method: "GET",
    headers: { "X-App-Token": appToken, "X-App-Access-Ts": ts, "X-App-Access-Sig": sig },
  });
  const text = await res.text();
  console.log("[sumsubGetApplicantStatus] status", res.status, text.slice(0, 600));
  if (res.status === 404) {
    return { applicantId: null, reviewAnswer: null, reviewStatus: null, kycStatus: kycStatus || "init" } as unknown as string;
  }
  if (!res.ok) throw new Error(`Sumsub status ${res.status}: ${text.slice(0, 300)}`);
  let j: { id?: string; review?: { reviewStatus?: string; reviewResult?: { reviewAnswer?: string; reviewRejectType?: string } }; reviewResult?: { reviewAnswer?: string; reviewRejectType?: string }; reviewStatus?: string } | null = null;
  try {
    j = JSON.parse(text);
  } catch {
    j = null;
  }
  const reviewAnswer = j?.review?.reviewResult?.reviewAnswer || (j as { reviewResult?: { reviewAnswer?: string } })?.reviewResult?.reviewAnswer || null;
  const reviewStatus = j?.review?.reviewStatus || (j as { reviewStatus?: string })?.reviewStatus || null;
  const reviewRejectType = j?.review?.reviewResult?.reviewRejectType || (j as { reviewResult?: { reviewRejectType?: string } })?.reviewResult?.reviewRejectType || null;

  // persist to UserProfile if we got an answer and profile exists
  if (reviewAnswer) {
    const derived = reviewAnswer === "GREEN" ? "green" : reviewAnswer === "RED" ? "red" : "pending";
    try {
      const prof = await (client.models.UserProfile as unknown as { byWallet: (a: { walletAddress: string }) => Promise<{ data: { id: string }[] }> }).byWallet({ walletAddress: externalUserId });
      const pid = prof.data?.[0]?.id;
      if (pid) {
        await (client.models.UserProfile as unknown as { update: (a: unknown) => Promise<unknown> }).update({ id: pid, applicantId: j?.id || applicantId, kycStatus: derived, kycReviewAnswer: reviewAnswer, kycRejectType: reviewRejectType });
      }
    } catch (e) {
      console.warn("[sumsubGetApplicantStatus] persist fail", e);
    }
    return { applicantId: j?.id || applicantId, reviewAnswer, reviewStatus, reviewRejectType, kycStatus: derived } as unknown as string;
  }

  return { applicantId: j?.id || applicantId, reviewAnswer, reviewStatus, reviewRejectType, kycStatus: kycStatus || "pending" } as unknown as string;
};
