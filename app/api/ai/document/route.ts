import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a document generator for AttestGO, a cross-chain RWA lending platform.
Generate a professional payment receipt document using the email content and transfer data provided.

Rules:
- Use the email content as the base — preserve its meaning and tone
- Include all transfer details from the data (wallets, amount, asset, date, tx hash)
- Format as a clean, human-readable receipt
- Include sender name/address, recipient name/address, amount, asset, date, transaction hash
- Mark as "Verified" if status is "verified" or "pending"
- Keep concise, single page
- Output ONLY the document text, no markdown code blocks`;

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
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
Originator: ${trData.originatorName || "N/A"} (${trData.originatorWallet || "N/A"})
Beneficiary: ${trData.beneficiaryName || "N/A"} (${trData.beneficiaryWallet || "N/A"})
Amount: ${trData.amount || "N/A"} ${trData.asset || ""}
Date: ${trData.createdAt ? new Date(trData.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
Transaction: ${trData.txHash || "N/A"}
Status: ${trData.status || "pending"}

Generate a payment receipt document using both sources.`;

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
