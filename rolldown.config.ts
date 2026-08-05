import { readFileSync } from "node:fs";
import { defineConfig } from "rolldown";

const rawPlugin = {
  name: "raw-asset",
  async resolveId(source: string, importer: string | undefined) {
    if (!source.endsWith("?raw")) return null;
    const res = await this.resolve(source.slice(0, -4), importer, { skipSelf: true });
    if (!res) return null;
    return { id: res.id + "?raw", moduleSideEffects: false };
  },
  load(id: string) {
    if (!id.endsWith("?raw")) return null;
    const content = readFileSync(id.slice(0, -4), "utf8");
    return `export default ${JSON.stringify(content)};`;
  },
};

export default defineConfig({
  input: "src/extension.ts",
  external: ["vscode"],
  platform: "node",
  // pi-ai declares sideEffects in its package.json that exclude the OAuth
  // flow modules (dist/bun-oauth.js). Registering them is a real side effect
  // (it arms the `bundledLoaders` fast-path that bypasses the bundler-opaque
  // dynamic imports) - forcing moduleSideEffects keeps rolldown from
  // tree-shaking the registration call away.
  treeshake: {
    moduleSideEffects: (id) => (id.includes("@earendil-works/pi-ai/") ? true : undefined),
  },
  output: {
    dir: "dist",
    cleanDir: true,
    entryFileNames: "extension.cjs",
    chunkFileNames: "chunks/[name]-[hash].cjs",
    format: "cjs",
    sourcemap: true,
    minify: true,
  },
  plugins: [rawPlugin],
});
