/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@messages/shared-types"],
  output: "standalone",
};

export default nextConfig;
