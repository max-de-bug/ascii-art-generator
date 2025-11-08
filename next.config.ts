import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack is the default bundler in Next.js 16
  // Turbopack has native WASM support - no additional config needed
  turbopack: {
    // Turbopack handles WASM modules natively
    // If you encounter issues, you can use --webpack flag as fallback
  },

  // Webpack configuration (fallback option)
  // Use --webpack flag in package.json scripts if Turbopack has issues
  webpack: (config, { isServer }) => {
    // Enable WASM support for Webpack fallback
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // Handle .wasm files
    config.module.rules.push({
      test: /\.wasm$/,
      type: "asset/resource",
    });

    return config;
  },
};

export default nextConfig;
