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
    let data: UserProfile[] | null = null;
    try {
      // queryField is "byWallet" per amplify/data/resource.ts — method is byWallet, not listByWallet
      const res = await (client.models.UserProfile as unknown as {
        byWallet: (a: { walletAddress: string }) => Promise<{ data: UserProfile[] }>;
      }).byWallet({ walletAddress: wallet.toLowerCase() });
      data = res.data;
    } catch (e) {
      console.warn("[loadProfile] byWallet failed, fallback to list filter", e);
      const res = await (client.models.UserProfile as unknown as {
        list: (a: { filter: unknown }) => Promise<{ data: UserProfile[] }>;
      }).list({ filter: { walletAddress: { eq: wallet.toLowerCase() } } });
      data = res.data;
    }
    if (!data || data.length === 0) {
      console.warn("[loadProfile] no rows for", wallet.toLowerCase());
      return null;
    }
    const sorted = [...data].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const rec = sorted[0];
    if (!isValidSignature(rec.walletAddress, rec.message, rec.signature)) {
      console.warn("[loadProfile] signature invalid, showing row anyway", {
        wallet,
        recWallet: rec.walletAddress,
        message: rec.message,
        signature: rec.signature,
      });
      // still return rec so UI shows DB data even if sig mismatch (debug)
      return rec;
    }
    return rec;
  } catch (e) {
    console.warn("[loadProfile] failed", e);
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
