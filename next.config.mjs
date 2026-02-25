/** @type {import('next').NextConfig} */
// If NEXT_PUBLIC_BASE_PATH is set (e.g., "/gavindle"), use it for project pages.
// Otherwise leave empty so custom domains deploy at root without a basePath.
const repo = process.env.NEXT_PUBLIC_BASE_PATH || "";
const isPages = process.env.GITHUB_PAGES === "true";
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // Use basePath only for project pages (username.github.io/repo)
  basePath: isPages && repo ? repo : undefined,
  // Avoid build hanging when ESLint isn't configured or telemetry is slow
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false }
};

export default nextConfig;

