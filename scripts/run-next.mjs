// Compatibility entry point for the desktop launcher. Always run this checkout.
// Old .runtime-local.json files and AppData mirrors are intentionally ignored.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const mode = process.argv[2] || "dev";
if (!["dev", "build", "start"].includes(mode)) {
  console.error("Usage: node scripts/run-next.mjs [dev|build|start]");
  process.exit(1);
}

const require = createRequire(path.join(workspace, "package.json"));
let next;
try {
  next = require.resolve("next/dist/bin/next");
} catch {
  console.error("Next.js is missing from this project. Run npm ci in " + workspace);
  process.exit(1);
}
const args = [next, mode];
if (mode !== "build") args.push("--hostname", "127.0.0.1", "--port", process.env.SARABUN_PORT || "3000");
args.push(...process.argv.slice(3));

const child = spawn(process.execPath, args, {
  cwd: workspace,
  stdio: "inherit",
  env: { ...process.env, SARABUN_SOURCE_DIR: workspace },
});
child.on("error", error => {
  console.error("Could not start Next.js:", error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
