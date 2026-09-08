import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const PLACEHOLDERS = [
  "{{senderName}}",
  "{{senderAddress}}",
  "{{recipientName}}",
  "{{recipientAddress}}",
  "{{amount}}",
  "{{asset}}",
  "{{cause}}",
  "{{txHash}}",
];

const SYSTEM_PROMPT = `You are an email template writer for AttestGO, a compliant onchain finance platform.
The user will describe the tone or purpose of their email. Write a short, professional email template using the available placeholders.

Rules:
- Use only these placeholders: ${PLACEHOLDERS.join(", ")}
- Format: greeting (1 line), body (2-3 lines), closing (1 line)
- Closing must be exactly: "Best,\nAttestGO Protocol"
- Keep it concise and professional
- Output ONLY the template text, no explanation or markdown
- Use natural language, not legal jargon`;

export async function POST(req: NextRequest) {
  try {
    const { prompt, cause } = await req.json();

    if (!prompt) {
      return NextResponse.json({ ok: false, error: "prompt required" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL || undefined;
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured" }, { status: 503 });
    }

    const client = new OpenAI({ apiKey, baseURL });

    const userMessage = `Transfer purpose: ${cause || "other"}\nUser's description: ${prompt}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const template = completion.choices[0]?.message?.content?.trim();

    if (!template) {
      return NextResponse.json({ ok: false, error: "AI returned empty response" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, template });
  } catch (e) {
    console.error("[api/ai/template] error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
