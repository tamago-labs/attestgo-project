import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import getConfig from "next/config";

const { serverRuntimeConfig } = getConfig();

const PLACEHOLDERS = [
  "{{senderName}}",
  "{{senderAddress}}",
  "{{recipientName}}",
  "{{recipientAddress}}",
  "{{amount}}",
  "{{asset}}",
  "{{cause}}",
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
  console.log("[api/ai/template] invoked");
  try {
    const { prompt, cause } = await req.json();
    console.log("[api/ai/template] prompt:", prompt, "cause:", cause);

    if (!prompt) {
      return NextResponse.json({ ok: false, error: "prompt required" }, { status: 400 });
    }

    const apiKey = serverRuntimeConfig.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "OPENAI_API_KEY not configured" }, { status: 503 });
    }
    console.log("[api/ai/template] key present, calling LongCat...");

    let client: OpenAI;
    try {
      client = new OpenAI({ apiKey, baseURL: "https://api.longcat.ai/openai/v1" });
    } catch (e) {
      console.error("[api/ai/template] OpenAI init error", e);
      return NextResponse.json({ ok: false, error: "AI client init failed" }, { status: 500 });
    }
    const model = "LongCat-2.0";

    const userMessage = `Transfer purpose: ${cause || "other"}\nUser's description: ${prompt}`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const template = completion.choices[0]?.message?.content?.trim();
    console.log("[api/ai/template] generated, length:", template?.length);

    if (!template) {
      return NextResponse.json({ ok: false, error: "AI returned empty response" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, template });
  } catch (e) {
    console.error("[api/ai/template] error", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
