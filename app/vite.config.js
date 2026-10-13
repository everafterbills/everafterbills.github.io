import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";

// The installed app compares itself against /version.json when it opens or comes back, and reloads if it's out of date.
const APP_VERSION = readFileSync(new URL("./src/config.js", import.meta.url), "utf8").match(/VERSION = "([^"]+)"/)[1];
const versionPlugin = {
  name: "ever-after-version",
  apply: "build",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ version: APP_VERSION }) });
  },
};

const SUPABASE = "https://qsaunieuztrbtbdbomie.supabase.co";
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self' ${SUPABASE} wss://qsaunieuztrbtbdbomie.supabase.co`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

// The Content-Security-Policy goes into the built page only (the dev server needs inline scripts).
const cspPlugin = {
  name: "ever-after-csp",
  apply: "build",
  transformIndexHtml(html) {
    return html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
  },
};

export default defineConfig({
  plugins: [react(), cspPlugin, versionPlugin],
  build: { target: "es2020", sourcemap: false, assetsInlineLimit: 0 },
});
