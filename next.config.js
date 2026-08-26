/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/api_docs", destination: "/docs", permanent: true },
      { source: "/api-docs", destination: "/docs", permanent: true },
      { source: "/docs/api", destination: "/docs#endpoints", permanent: false },
    ];
  },
}

module.exports = nextConfig
