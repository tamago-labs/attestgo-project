"use client";

import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";
import outputs from "@/amplify_outputs.json";

let _client: ReturnType<typeof generateClient<Schema>> | null = null;
export function getClient() {
  if (_client) return _client;
  try {
    Amplify.configure(outputs, { ssr: true });
  } catch {}
  _client = generateClient<Schema>();
  return _client;
}

export type TokenRegistryEntry = {
  id: string;
  userProfileId: string;
  tokenRecordId?: string | null;
  tokenAddress: string;
  chainId: number;
  isCustom: boolean;
  symbol: string;
  name?: string | null;
  decimals?: number | null;
  addedAt?: string;
  createdAt?: string;
};

export async function listMyTokens(userProfileId: string): Promise<TokenRegistryEntry[]> {
  if (!userProfileId) return [];
  const client = getClient();
  try {
    const res = await (client.models.UserTokenRegistry as unknown as {
      listMyTokens: (a: { userProfileId: string }) => Promise<{ data: TokenRegistryEntry[] }>;
    }).listMyTokens({ userProfileId });
    return (res.data || []).sort((a, b) => (b.createdAt || b.addedAt || "").localeCompare(a.createdAt || a.addedAt || ""));
  } catch {
    const res = await (client.models.UserTokenRegistry as unknown as {
      list: (a: { filter: unknown }) => Promise<{ data: TokenRegistryEntry[] }>;
    }).list({ filter: { userProfileId: { eq: userProfileId } } });
    return (res.data || []).sort((a, b) => (b.createdAt || b.addedAt || "").localeCompare(a.createdAt || a.addedAt || ""));
  }
}

export async function addFactoryToken(userProfileId: string, record: { id: string; tokenAddress: string; chainId: number; symbol: string; name: string; decimals: number }): Promise<TokenRegistryEntry | null> {
  const client = getClient();
  const existing = await listMyTokens(userProfileId);
  if (existing.some((e) => e.tokenAddress.toLowerCase() === record.tokenAddress.toLowerCase() && e.chainId === record.chainId))
    throw new Error("Already in registry");
  const { data } = await client.models.UserTokenRegistry.create({
    userProfileId,
    tokenRecordId: record.id,
    tokenAddress: record.tokenAddress.toLowerCase(),
    chainId: record.chainId,
    isCustom: false,
    symbol: record.symbol,
    name: record.name,
    decimals: record.decimals,
    addedAt: new Date().toISOString(),
  });
  return data as unknown as TokenRegistryEntry;
}

export async function addCustomToken(
  userProfileId: string,
  input: { tokenAddress: string; chainId: number; symbol: string; name?: string; decimals?: number }
): Promise<TokenRegistryEntry | null> {
  const client = getClient();
  const clean = input.tokenAddress.toLowerCase();
  const existing = await listMyTokens(userProfileId);
  if (existing.some((e) => e.tokenAddress.toLowerCase() === clean && e.chainId === input.chainId)) throw new Error("Already in registry");
  const { data } = await client.models.UserTokenRegistry.create({
    userProfileId,
    tokenAddress: clean,
    chainId: input.chainId,
    isCustom: true,
    symbol: input.symbol,
    name: input.name,
    decimals: input.decimals,
    addedAt: new Date().toISOString(),
  });
  return data as unknown as TokenRegistryEntry;
}

export async function removeRegistryEntry(id: string): Promise<void> {
  const client = getClient();
  await client.models.UserTokenRegistry.delete({ id });
}
