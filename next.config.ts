import type { NextConfig } from "next";

// Nearly every page reads the signed-in user's own data, so we use the
// request-time rendering model rather than Cache Components.
const nextConfig: NextConfig = {
  serverExternalPackages: ["wink-lemmatizer", "wink-lexicon"],
};

export default nextConfig;
