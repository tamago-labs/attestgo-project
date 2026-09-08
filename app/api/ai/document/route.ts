import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a document generator for AttestGO, a cross-chain RWA lending platform.
Generate a professional compliance document using the email content and transfer data provided.

Rules:
- Extract sender name and recipient name from the EMAIL CONTENT (e.g. "From: Jane Doe", "Hi John")
- Use transfer data for wallet addresses, amount, asset, date, transaction hash
- If a name is missing from email, use the travel rule originator/beneficiary name
- Format as a clean, structured document with sections
- Include: sender info, recipient info, transaction details, status
- Keep concise, single page
- Output ONLY the document text, no markdown code blocks`;

export async function POST(req: NextRequest) {
  console.log("[api/ai/document] invoked");
  try {
    const data = await req.json();
    console.log("[api/ai/document] email length:", data.emailContent?.length, "travelRule keys:", Object.keys(data.travelRule || {}));

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

Generate a compliance document based on the email and transfer data.`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });
    console.log("[api/ai/document] completion received");

    const document = completion.choices[0]?.message?.content?.trim();

    if (!document) {
      return NextResponse.json({ ok: false, error: "AI returned empty response" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, document });
  } catch (e) {
    console.error("[api/ai/document] error:", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
