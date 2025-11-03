import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Context7 MCP inspired optimizations for producti
  
  // Performance optimizations (disable optimizeCss to avoid missing 'critters' during build)
  // experimental: {
  //   optimizeCss: true,
  // },
  // Allow production build to pass with ESLint errors (we still lint in CI/editor)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Security headers
  async headers() {
    return [
      // Relax COOP for login page to allow Google OAuth popup postMessage
      {
        source: '/login',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          // Keep other common security headers
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;