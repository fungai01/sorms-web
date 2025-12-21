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
  
  // Webpack configuration to handle Node.js modules in browser
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ignore Node.js modules that aren't available in the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        encoding: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        url: false,
        http: false,
        https: false,
        zlib: false,
        querystring: false,
        os: false,
        net: false,
        tls: false,
        child_process: false,
      };
      
      // Use IgnorePlugin to ignore encoding module when imported by node-fetch
      const webpack = require("webpack");
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^encoding$/,
          contextRegExp: /node-fetch/,
        })
      );
    }
    
    return config;
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