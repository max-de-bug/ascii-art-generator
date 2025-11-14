import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Using Turbopack only (default bundler in Next.js 16)
  // Turbopack has native WASM support - no additional config needed
  // For Node.js-only modules, we use serverExternalPackages and ensure
  // client-side code uses dynamic imports with "use client" directive
  
  // Tell Next.js to treat these packages as external (don't bundle them for server)
  // This prevents Next.js from trying to analyze Node.js-only dependencies
  serverExternalPackages: [
    '@bundlr-network/client',
    '@aptos-labs/aptos-client',
    'got',
    'avsc',
    'arbundles',
  ],
  
  // Turbopack configuration
  // Alias Node.js built-in modules to empty module for client bundles
  // This prevents Turbopack from trying to bundle Node.js-only modules
  turbopack: {
    resolveAlias: {
      'fs': { browser: './empty-module.ts' },
      'net': { browser: './empty-module.ts' },
      'tls': { browser: './empty-module.ts' },
      'crypto': { browser: './empty-module.ts' },
      'stream': { browser: './empty-module.ts' },
      'url': { browser: './empty-module.ts' },
      'zlib': { browser: './empty-module.ts' },
      'http': { browser: './empty-module.ts' },
      'https': { browser: './empty-module.ts' },
      'assert': { browser: './empty-module.ts' },
      'os': { browser: './empty-module.ts' },
      'path': { browser: './empty-module.ts' },
      'util': { browser: './empty-module.ts' },
    },
  },
};

export default nextConfig;
