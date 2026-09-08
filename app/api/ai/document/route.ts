import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a payment receipt generator for AttestGO, a cross-chain RWA lending platform.
Generate a clean, human-readable PAYMENT RECEIPT using the provided transfer data.

Format exactly like this example:

PAYMENT RECEIPT
==============

From: {{originatorName}} ({{originatorWallet}})
To: {{beneficiaryName}} ({{beneficiaryWallet}})
Amount: {{amount}} {{asset}}
Date: {{date}}
Transaction: {{txHash}}
Status: Verified

Must be concise, professional, single page.
Output ONLY the receipt text, no markdown, no extra sections, no compliance jargon.`;

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured" }, { status: 503 });
    }

    const client = new OpenAI({ apiKey, baseURL: "https://api.longcat.ai/openai/v1" });
    const model = "LongCat-2.0";

    const userMessage = `Generate a payment receipt with this data:

originatorName: ${data.originatorName || "N/A"}
originatorWallet: ${data.originatorWallet || "N/A"}
beneficiaryName: ${data.beneficiaryName || "N/A"}
beneficiaryWallet: ${data.beneficiaryWallet || "N/A"}
amount: ${data.amount || "N/A"}
asset: ${data.asset || "N/A"}
txHash: ${data.txHash || "N/A"}
date: ${data.createdAt ? new Date(data.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const document = completion.choices[0]?.message?.content?.trim();

    if (!document) {
      return NextResponse.json({ ok: false, error: "AI returned empty response" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, document });
  } catch (e) {
    console.error("[api/ai/document] error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
