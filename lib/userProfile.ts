"use client";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import { verifyMessage } from "ethers";
import outputs from "@/amplify_outputs.json";

let _client: ReturnType<typeof generateClient<Schema>> | null = null;
function getClient() {
  if (_client) return _client;
  // fallback configure if ConfigureAmplify not yet run (e.g. direct import before layout)
  try {
    Amplify.configure(outputs, { ssr: true });
  } catch {}
  _client = generateClient<Schema>();
  return _client;
}

export type UserProfile = {
  id: string;
  walletAddress: string;
  displayName: string;
  country: string;
  message: string;
  signature: string;
  createdAt?: string;
  updatedAt?: string;
};

export function buildMessage(wallet: string, displayName: string, country: string): string {
  return `AttestGO Profile\nwallet:${wallet.toLowerCase()}\ndisplayName:${displayName}\ncountry:${country}`;
}

export function isValidSignature(wallet: string, message: string, signature: string): boolean {
  try {
    const recovered = verifyMessage(message, signature);
    return recovered.toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
}

export async function loadProfile(wallet: string): Promise<UserProfile | null> {
  if (!wallet) return null;
  try {
    const client = getClient();
    const { data } = await (client.models.UserProfile as unknown as {
      listByWallet: (a: { walletAddress: string }) => Promise<{ data: UserProfile[] }>;
    }).listByWallet({ walletAddress: wallet.toLowerCase() });
    if (!data || data.length === 0) return null;
    // newest first
    const sorted = [...data].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const rec = sorted[0];
    // verify on read (frontend per time)
    if (!isValidSignature(rec.walletAddress, rec.message, rec.signature)) return null;
    return rec;
  } catch {
    return null;
  }
}

export async function saveProfile(input: {
  walletAddress: string;
  displayName: string;
  country: string;
  message: string;
  signature: string;
}): Promise<UserProfile | null> {
  const client = getClient();
  // check existing
  const existing = await loadProfile(input.walletAddress);
  if (existing) {
    const { data } = await client.models.UserProfile.update({
      id: existing.id,
      displayName: input.displayName,
      country: input.country,
      message: input.message,
      signature: input.signature,
    });
    return data as unknown as UserProfile;
  }
  const { data } = await client.models.UserProfile.create({
    walletAddress: input.walletAddress.toLowerCase(),
    displayName: input.displayName,
    country: input.country,
    message: input.message,
    signature: input.signature,
  });
  return data as unknown as UserProfile;
}
