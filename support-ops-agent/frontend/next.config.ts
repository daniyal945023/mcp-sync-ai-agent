import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
   devIndicators: {
    position: 'bottom-right', // Options: 'top-left', 'top-right', 'bottom-left', 'bottom-right'
  },
};

export default nextConfig;
