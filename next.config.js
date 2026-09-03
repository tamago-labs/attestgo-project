/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s2.coinmarketcap.com" },
      { protocol: "https", hostname: "attestcoin.org" },
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "coin-images.coingecko.com" },
      { protocol: "https", hostname: "play-lh.googleusercontent.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/api_docs", destination: "/docs", permanent: true },
      { source: "/api-docs", destination: "/docs", permanent: true },
      { source: "/docs/api", destination: "/docs#endpoints", permanent: false },
    ];
  },
}

module.exports = nextConfig
