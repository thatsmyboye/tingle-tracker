/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@tingle/ui", "@tingle/database", "@tingle/types", "@tingle/ai"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
    ],
  },
};

export default nextConfig;
