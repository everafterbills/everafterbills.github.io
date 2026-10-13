import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
  plugins: [react(), cspPlugin],
  build: { target: "es2020", sourcemap: false, assetsInlineLimit: 0 },
});
