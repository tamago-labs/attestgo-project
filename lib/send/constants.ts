export const COUNTRIES = [
  { code: "TH", name: "Thailand" },
  { code: "SG", name: "Singapore" },
  { code: "JP", name: "Japan" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "HK", name: "Hong Kong" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "IN", name: "India" },
  { code: "BR", name: "Brazil" },
  { code: "AE", name: "UAE" },
  { code: "CH", name: "Switzerland" },
  { code: "SE", name: "Sweden" },
  { code: "NL", name: "Netherlands" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
];

export const truncateAddr = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
