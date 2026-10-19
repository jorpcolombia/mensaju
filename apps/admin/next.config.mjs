/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@messages/shared-types"],
  // Standalone output needs symlink privileges that Windows often lacks; set
  // NEXT_DISABLE_STANDALONE=1 for local Windows builds. Docker/Railway keep standalone.
  output: process.env.NEXT_DISABLE_STANDALONE ? undefined : "standalone",
};

export default nextConfig;
