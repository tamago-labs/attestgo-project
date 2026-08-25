"use client";

export type MockPass = {
  wallet: string;
  tier: number;
  country: string; // single ISO2, e.g. US
  customerId: string;
  customerIdHash: string;
  kycSource: string; // sumsub or ""
  expiry: number; // unix sec
  status: "Active" | "Pending";
  createdAt: number;
};

export const MOCK_PASS_KEY = "attestgo:mockPass";

export function loadMockPass(): MockPass | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MOCK_PASS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MockPass;
  } catch {
    return null;
  }
}

export function saveMockPass(p: MockPass) {
  localStorage.setItem(MOCK_PASS_KEY, JSON.stringify(p));
}

export function deleteMockPass() {
  localStorage.removeItem(MOCK_PASS_KEY);
}
