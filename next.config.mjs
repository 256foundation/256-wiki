/** @type {import('next').NextConfig} */
const nextConfig = {
  // static export → S3 + CloudFront (all read paths; /api + /mcp are Lambda behind the same CDN)
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },

  // In `next dev`, proxy the API lambda (npm run dev:api) so /api and /mcp work
  // locally. Rewrites are ignored during static export — production routes them
  // at the CloudFront layer (infra/cloudfront.tf).
  async rewrites() {
    const api = process.env.WIKI_API_ORIGIN || "http://localhost:8787";
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/a/:path*", destination: `${api}/a/:path*` },
      { source: "/mcp", destination: `${api}/mcp` },
    ];
  },
};

export default nextConfig;
