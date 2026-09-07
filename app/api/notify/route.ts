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
    const { title, body: messageBody, txHash, type, walletAddress } = body;

    if (!title || !messageBody) {
      return NextResponse.json({ ok: false, error: "title and body required" }, { status: 400 });
    }

    // Look up user profile by wallet
    let recipientId: string | null = null;
    if (walletAddress) {
      try {
        const res = await (client.models.UserProfile as unknown as {
          byWallet: (a: { walletAddress: string }) => Promise<{ data: { id: string }[] }>;
        }).byWallet({ walletAddress: walletAddress.toLowerCase() });
        if (res.data && res.data.length > 0) {
          recipientId = res.data[0].id;
        }
      } catch {
        // no profile, skip notification
      }
    }

    if (!recipientId) {
      return NextResponse.json({ ok: false, error: "no profile found" }, { status: 200 });
    }

    await client.models.InboxItem.create({
      type: type || "lending",
      title,
      body: messageBody,
      read: false,
      txHash: txHash || null,
      recipientId,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/notify] error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
