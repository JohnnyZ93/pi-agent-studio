import { defineConfig } from "rolldown";

export default defineConfig({
  input: "src/index.ts",
  external: [/^@earendil-works\//, "typebox"],
  platform: "node",
  output: {
    file: "../bridge/mcp/index.js",
    format: "esm",
    sourcemap: false,
    minify: true,
  },
});
