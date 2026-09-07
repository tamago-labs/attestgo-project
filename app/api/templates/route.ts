import { NextRequest, NextResponse } from "next/server";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import outputs from "@/amplify_outputs.json";

Amplify.configure(outputs, { ssr: true });
const client = generateClient<Schema>();

export async function GET(req: NextRequest) {
  try {
    const userProfileId = req.nextUrl.searchParams.get("userProfileId");
    if (!userProfileId) {
      return NextResponse.json({ ok: false, error: "userProfileId required" }, { status: 400 });
    }
    const res = await (client.models.EmailTemplate as unknown as {
      list: (a: { filter: { userProfileId: { eq: string } } }) => Promise<{ data: unknown[] }>;
    }).list({ filter: { userProfileId: { eq: userProfileId } } });
    return NextResponse.json({ ok: true, templates: res.data });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userProfileId, cause, template } = await req.json();
    if (!userProfileId || !cause || !template) {
      return NextResponse.json({ ok: false, error: "userProfileId, cause, template required" }, { status: 400 });
    }
    // Upsert: check if exists
    const existing = await (client.models.EmailTemplate as unknown as {
      list: (a: { filter: { userProfileId: { eq: string }; cause: { eq: string } } }) => Promise<{ data: { id?: string }[] }>;
    }).list({ filter: { userProfileId: { eq: userProfileId }, cause: { eq: cause } } });
    if (existing.data && existing.data.length > 0 && existing.data[0].id) {
      const { data } = await client.models.EmailTemplate.update({
        id: existing.data[0].id,
        template,
      });
      return NextResponse.json({ ok: true, id: data?.id });
    }
    const { data } = await client.models.EmailTemplate.create({
      userProfileId,
      cause,
      template,
    });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
