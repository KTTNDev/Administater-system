const config = {
  distDir: process.env.SARABUN_BUILD === "desktop" ? ".next-desktop" : process.env.SARABUN_BUILD === "procurement-lab" ? ".next-procurement-lab" : process.env.SARABUN_BUILD === "procurement-main-demo" ? ".next-procurement-main" : ".next-workspace",
  output: process.env.SARABUN_BUILD === "desktop" ? "standalone" : undefined,
  serverExternalPackages: ["playwright"],
  outputFileTracingIncludes: { "/*": ["node_modules/playwright/**/*", "node_modules/playwright-core/**/*"] },
  experimental: {
    cpus: 1,
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Referrer-Policy", value: "same-origin" },
    ] }];
  },
};

export default config;
