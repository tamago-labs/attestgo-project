import { NextRequest, NextResponse } from "next/server";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import outputs from "@/amplify_outputs.json";

Amplify.configure(outputs, { ssr: true });
const client = generateClient<Schema>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      txHash,
      originatorWallet,
      originatorName,
      originatorCountry,
      beneficiaryWallet,
      beneficiaryName,
      beneficiaryInstitution,
      beneficiaryCountry,
      beneficiaryIsSelfHosted,
      amount,
      asset,
      senderId,
      cause,
      customNote,
      emailSubject,
      emailBody,
      docs,
    } = body;

    // Look up recipient profile by wallet
    let recipientId: string | null = null;
    try {
      const res = await (client.models.UserProfile as unknown as {
        byWallet: (a: { walletAddress: string }) => Promise<{ data: { id: string }[] }>;
      }).byWallet({ walletAddress: beneficiaryWallet.toLowerCase() });
      if (res.data && res.data.length > 0) {
        recipientId = res.data[0].id;
      }
    } catch {
      // recipient may not have a profile yet
    }

    // Create InboxItem first (so we can link it to TravelRuleData)
    let inboxItemId: string | null = null;
    if (recipientId) {
      const { data: inbox } = await client.models.InboxItem.create({
        type: "send",
        title: emailSubject,
        body: emailBody,
        read: false,
        txHash,
        senderId: senderId || null,
        recipientId,
        docs: docs as string[] | null,
      });
      inboxItemId = inbox?.id ?? null;
    }

    // Create TravelRuleData linked to InboxItem
    const { data: travelRule } = await client.models.TravelRuleData.create({
      txHash,
      originatorWallet: originatorWallet.toLowerCase(),
      originatorName,
      originatorCountry,
      beneficiaryWallet: beneficiaryWallet.toLowerCase(),
      beneficiaryName,
      beneficiaryInstitution: beneficiaryInstitution || null,
      beneficiaryCountry,
      beneficiaryIsSelfHosted,
      amount,
      asset,
      status: "pending",
      ...(inboxItemId ? { inboxItemId } : {}),
      ...(docs?.length ? { docs: docs as string[] } : {}),
    });

    return NextResponse.json({ ok: true, travelRuleId: travelRule?.id ?? null });
  } catch (e) {
    console.error("[api/send] error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
