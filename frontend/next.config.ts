import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://20.17.163.158/api/:path*',
      },
    ];
  },
};

export default nextConfig;
