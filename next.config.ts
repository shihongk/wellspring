import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['tesseract.js', 'pdf-parse'],
};

export default nextConfig;
