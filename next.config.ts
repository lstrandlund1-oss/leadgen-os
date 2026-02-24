import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Explicitly disable source map generation for production if not needed,
  // but keep default behavior for dev to avoid parsing errors.
  productionBrowserSourceMaps: false,

  // 2. Ensure we aren't accidentally opting into unstable experimental features
  // that might conflict with v16 defaults.
  experimental: {
    // serverActions are stable in v16, so no need to enable them here.
    // If you had 'turbo' specific configs here, remove them.
  },

  // 3. DO NOT manually override webpack config unless absolutely necessary.
  // The code you likely had here (config.infrastructureLogging, etc.)
  // is what broke the source map parsing.
};

export default nextConfig;









