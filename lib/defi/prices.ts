import { getClient } from "@/lib/tokenRegistry";

export async function fetchPriceMap(): Promise<Record<string, number>> {
  try {
    const client = getClient();
    const res = await (client.models.AssetPrice as unknown as { list: (a?: unknown) => Promise<{ data: { symbol: string; priceUSD: number }[] }> }).list();
    const map: Record<string, number> = {};
    (res.data || []).forEach((r) => {
      if (r.symbol && typeof r.priceUSD === "number") map[r.symbol] = r.priceUSD;
    });
    return map;
  } catch {
    return {};
  }
}
