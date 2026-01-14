/** @type {import('next').NextConfig} */
const repo = process.env.NEXT_PUBLIC_BASE_PATH || "/gavindle";
const isPages = process.env.GITHUB_PAGES === "true";
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // Use basePath only for project pages (username.github.io/repo)
  basePath: isPages && repo ? repo : undefined
};

export default nextConfig;

