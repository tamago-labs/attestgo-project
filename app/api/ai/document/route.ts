import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import getConfig from "next/config";

const { serverRuntimeConfig } = getConfig();

const SYSTEM_PROMPT = `You are a document generator for AttestGO, a cross-chain RWA lending platform.
Generate a professional Transfer Record document using the email content and transfer data provided.

CRITICAL RULES:
- Do NOT include any reasoning, analysis, or step-by-step thinking
- Do NOT include numbered lists like "1. Analyze..." or "2. Extract..."
- Output ONLY the final document — nothing else
- Start directly with the document header

Include:
- Sender info (name, wallet, country)
- Recipient info (name, wallet, country)
- Transaction details (amount, asset, date, tx hash, status)

Keep it clean, structured, single page.`;

export async function POST(req: NextRequest) {
  console.log("[api/ai/document] invoked");
  try {
    const data = await req.json();
    console.log("[api/ai/document] email length:", data.emailContent?.length, "travelRule keys:", Object.keys(data.travelRule || {}));

    const apiKey = serverRuntimeConfig.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured" }, { status: 503 });
    }

    const client = new OpenAI({ apiKey, baseURL: "https://api.longcat.ai/openai/v1" });
    const model = "LongCat-2.0";

    const emailContent = data.emailContent || "No email content available.";
    const trData = data.travelRule || {};

    const userMessage = `EMAIL CONTENT:
${emailContent}

TRANSFER DATA:
Originator: ${trData.originatorName || "N/A"} (${trData.originatorWallet || "N/A"}, ${trData.originatorCountry || "N/A"})
Beneficiary: ${trData.beneficiaryName || "N/A"} (${trData.beneficiaryWallet || "N/A"}, ${trData.beneficiaryCountry || "N/A"})
Amount: ${trData.amount || "N/A"} ${trData.asset || ""}
Date: ${trData.createdAt ? new Date(trData.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
Transaction: ${trData.txHash || "N/A"}
Status: ${trData.status || "pending"}

Generate a compliance document based on the email and transfer data.`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });
    const choice = completion.choices[0];
    const message = choice?.message as unknown as { content?: string; reasoning_content?: string };

    // LongCat/reasoning models return content in reasoning_content
    let raw = message?.content || message?.reasoning_content || "";

    // Strip reasoning steps if model still includes them
    const docStart = raw.indexOf("ATTESTGO");
    const docStart2 = raw.indexOf("TRANSFER");
    const docStart3 = raw.indexOf("---");
    const firstHeader = [docStart, docStart2, docStart3].filter(i => i >= 0).sort((a, b) => a - b)[0];
    if (firstHeader && firstHeader > 0) {
      raw = raw.substring(firstHeader);
    }

    const document = raw.trim();

    console.log("[api/ai/document] finish:", choice?.finish_reason, "len:", document.length);

    if (!document) {
      return NextResponse.json({ ok: false, error: "AI returned empty response" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, document });
  } catch (e) {
    console.error("[api/ai/document] error:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
