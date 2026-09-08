import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a compliance document generator for AttestGO, a cross-chain RWA lending platform.
Generate a professional Travel Rule compliance document in plain text format.

Use the provided travel rule data to create a FATF-compliant transfer record.
Include all parties, amounts, dates, and transaction references.
Format as a structured compliance report.

Available placeholders will be replaced with actual data.
Output ONLY the document text, no markdown code blocks or explanation.`;

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured" }, { status: 503 });
    }

    const client = new OpenAI({ apiKey, baseURL: "https://api.longcat.ai/openai/v1" });
    const model = "LongCat-2.0";

    const userMessage = `Generate a Travel Rule compliance document with this data:

Originator Name: ${data.originatorName || "N/A"}
Originator Wallet: ${data.originatorWallet || "N/A"}
Originator Country: ${data.originatorCountry || "N/A"}
Beneficiary Name: ${data.beneficiaryName || "N/A"}
Beneficiary Wallet: ${data.beneficiaryWallet || "N/A"}
Beneficiary Country: ${data.beneficiaryCountry || "N/A"}
Beneficiary Institution: ${data.beneficiaryInstitution || "N/A"}
Beneficiary Self-Custody: ${data.beneficiaryIsSelfHosted ? "Yes" : "No"}
Amount: ${data.amount || "N/A"}
Asset: ${data.asset || "N/A"}
Transaction Hash: ${data.txHash || "N/A"}
Status: ${data.status || "pending"}`;

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
