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

export type AddressBookEntry = {
  id: string;
  ownerId: string;
  contactAddress: string;
  label?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export async function listAddressBook(ownerId: string): Promise<AddressBookEntry[]> {
  if (!ownerId) return [];
  const client = getClient();
  try {
    const res = await (client.models.AddressBookEntry as unknown as {
      listByOwner: (a: { ownerId: string }) => Promise<{ data: AddressBookEntry[] }>;
    }).listByOwner({ ownerId });
    return (res.data || []).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  } catch {
    const res = await (client.models.AddressBookEntry as unknown as {
      list: (a: { filter: unknown }) => Promise<{ data: AddressBookEntry[] }>;
    }).list({ filter: { ownerId: { eq: ownerId } } });
    return (res.data || []).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
}

export async function addAddressBookEntry(ownerId: string, contactAddress: string, label?: string): Promise<AddressBookEntry | null> {
  const client = getClient();
  const clean = contactAddress.toLowerCase();
  // dup check client side
  const existing = await listAddressBook(ownerId);
  if (existing.some((e) => e.contactAddress.toLowerCase() === clean)) throw new Error("Already in address book");
  const { data } = await client.models.AddressBookEntry.create({
    ownerId,
    contactAddress: clean,
    label: label?.trim() || undefined,
  });
  return data as unknown as AddressBookEntry;
}

export async function removeAddressBookEntry(id: string): Promise<void> {
  const client = getClient();
  await client.models.AddressBookEntry.delete({ id });
}

export async function resolveContact(contactAddress: string) {
  const client = getClient();
  try {
    const res = await (client.models.UserProfile as unknown as {
      byWallet: (a: { walletAddress: string }) => Promise<{ data: { displayName: string; country: string }[] }>;
    }).byWallet({ walletAddress: contactAddress.toLowerCase() });
    const row = res.data?.[0];
    if (row) return row;
  } catch {}
  try {
    const res = await (client.models.UserProfile as unknown as {
      list: (a: { filter: unknown }) => Promise<{ data: { displayName: string; country: string }[] }>;
    }).list({ filter: { walletAddress: { eq: contactAddress.toLowerCase() } } });
    return res.data?.[0] || null;
  } catch {
    return null;
  }
}
