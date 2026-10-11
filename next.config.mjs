const config = {
  distDir: process.env.SARABUN_BUILD === "desktop" ? ".next-desktop" : ".next-workspace",
  output: process.env.SARABUN_BUILD === "desktop" ? "standalone" : undefined,
  serverExternalPackages: ["playwright"],
  outputFileTracingIncludes: { "/*": ["node_modules/playwright/**/*", "node_modules/playwright-core/**/*"] },
  experimental: {
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
