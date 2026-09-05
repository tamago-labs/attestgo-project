"use client";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import outputs from "@/amplify_outputs.json";

let _client: ReturnType<typeof generateClient<Schema>> | null = null;
function getClient() {
  if (_client) return _client;
  try {
    Amplify.configure(outputs, { ssr: true });
  } catch {}
  _client = generateClient<Schema>();
  return _client;
}

export type LockRecord = {
  id: string;
  ownerWallet: string;
  marketSlug: string;
  lockTxHash: string;
  blockNumber: number;
  lockId: string;
  amount: string; // decimal string (18 decimals)
  nonce: number;
  status: "locked" | "attesting" | "attested" | "failed";
  attestTxHash?: string | null;
};

export async function listLockRecords(ownerWallet: string, marketSlug: string): Promise<LockRecord[]> {
  if (!ownerWallet) return [];
  const client = getClient();
  try {
    const res = await (client.models.LockRecord as unknown as {
      byLockOwner: (a: { ownerWallet: string }) => Promise<{ data: LockRecord[] }>;
    }).byLockOwner({ ownerWallet: ownerWallet.toLowerCase() });
    return (res.data || []).filter((r) => r.marketSlug === marketSlug);
  } catch {
    const res = await (client.models.LockRecord as unknown as {
      list: (a: { filter: unknown }) => Promise<{ data: LockRecord[] }>;
    }).list({ filter: { ownerWallet: { eq: ownerWallet.toLowerCase() }, marketSlug: { eq: marketSlug } } });
    return res.data || [];
  }
}

export async function createLockRecord(rec: {
  ownerWallet: string;
  marketSlug: string;
  lockTxHash: string;
  blockNumber: number;
  lockId: string;
  amount: string;
  nonce: number;
}): Promise<LockRecord | null> {
  const client = getClient();
  const { data } = await client.models.LockRecord.create({
    ownerWallet: rec.ownerWallet.toLowerCase(),
    marketSlug: rec.marketSlug,
    lockTxHash: rec.lockTxHash,
    blockNumber: rec.blockNumber,
    lockId: rec.lockId,
    amount: rec.amount,
    nonce: rec.nonce,
    status: "locked",
  });
  return data as unknown as LockRecord;
}

export async function updateLockStatus(id: string, status: LockRecord["status"], attestTxHash?: string): Promise<void> {
  const client = getClient();
  const input: { id: string; status: LockRecord["status"]; attestTxHash?: string } = {
    id,
    status,
    ...(attestTxHash ? { attestTxHash } : {}),
  };
  await (client.models.LockRecord.update as unknown as (a: unknown) => Promise<unknown>)(input);
}

/** Trigger the sponsored proof submission (lambda: getProof -> verify -> verifyAndSupplyCollateral). */
export async function attestLock(lockTxHash: string, marketSlug: string): Promise<{ status: string; txHash?: string; lockId?: string; reason?: string }> {
  const client = getClient();
  const res = await (client.mutations as unknown as {
    attestLock: (a: { lockTxHash: string; marketSlug: string }) => Promise<{ data: unknown; errors?: { message: string }[] }>;
  }).attestLock({ lockTxHash, marketSlug });
  if (res.errors) throw new Error(res.errors.map((e) => e.message).join(", "));
  let raw = res.data as unknown;
  if (typeof raw === "string") {
    for (let i = 0; i < 3 && typeof raw === "string"; i++) {
      try {
        raw = JSON.parse(raw as string);
      } catch {
        break;
      }
    }
  }
  return (raw as { status: string; txHash?: string; lockId?: string; reason?: string }) || { status: "unknown" };
}
