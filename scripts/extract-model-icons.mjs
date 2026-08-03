// Extracts inline SVG path data for known model vendors from @lobehub/icons
// (devDependency) and generates src/chat/model-icons-data.ts.
//
// Run before every build (see package.json). Reads
// node_modules/@lobehub/icons/es/<Vendor>/components/Mono.js and pulls every
// `d: "..."` path string via regex, then emits a TS module consumed by the
// webview chat panel (model icons in composer + message timestamps).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkgJsonPath = require.resolve("@lobehub/icons/package.json");
const OUT_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../pi-chat/src/model-icons-data.ts",
);

function formatWithOxfmt(file) {
  const binDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../node_modules/.bin");
  const bin = path.join(binDir, process.platform === "win32" ? "oxfmt.cmd" : "oxfmt");
  try {
    execFileSync(bin, [file], { stdio: "inherit" });
  } catch (err) {
    console.error(`[extract-model-icons] oxfmt failed on ${file}: ${err.message}`);
    process.exit(1);
  }
}

// vendor -> directory name inside @lobehub/icons/es
// Order defines prefix-match priority (first hit wins), mirroring the octopus
// model-icons table. Prefixes are matched lower-case after stripping
// everything before the first "/" of a model id (e.g. "qwen/gpt-5.2" -> "gpt-5.2").
const ENTRIES = [
  {
    vendor: "OpenAI",
    color: "#10A37F",
    prefixes: ["gpt-", "o1", "o3", "o4", "chatgpt", "text-embedding", "dall-e", "openai"],
  },
  { vendor: "Claude", color: "#D7765A", prefixes: ["claude", "anthropic"] },
  { vendor: "Gemini", color: "#4285F4", prefixes: ["gemini"] },
  { vendor: "Gemma", color: "#4285F4", prefixes: ["gemma"] },
  { vendor: "Google", color: "#4285F4", prefixes: ["palm", "google"] },
  { vendor: "DeepSeek", color: "#4D6BFE", prefixes: ["deepseek"] },
  { vendor: "Grok", color: "#000000", prefixes: ["grok", "xai"] },
  { vendor: "Qwen", color: "#6B4EFF", prefixes: ["qwen", "qwq", "alibaba"] },
  { vendor: "Zhipu", color: "#3C5BFC", prefixes: ["glm", "chatglm", "zhipu", "z-ai"] },
  { vendor: "Minimax", color: "#1A1A2E", prefixes: ["minimax", "abab"] },
  { vendor: "Kimi", color: "#000000", prefixes: ["moonshot", "kimi"] },
  { vendor: "Mistral", color: "#F7D046", prefixes: ["mistral", "mixtral", "codestral", "pixtral"] },
  { vendor: "Meta", color: "#0668E1", prefixes: ["llama", "meta-llama", "meta"] },
  { vendor: "Doubao", color: "#00D6C2", prefixes: ["doubao", "skylark", "bytedance"] },
  { vendor: "Yi", color: "#1B1464", prefixes: ["yi-", "01-ai"] },
  { vendor: "Hunyuan", color: "#0052D9", prefixes: ["hunyuan"] },
  { vendor: "Spark", color: "#0078FF", prefixes: ["spark"] },
  { vendor: "Wenxin", color: "#2932E1", prefixes: ["ernie", "wenxin", "baidu"] },
  { vendor: "InternLM", color: "#2F54EB", prefixes: ["internlm"] },
  { vendor: "Stepfun", color: "#5B5CFF", prefixes: ["stepfun", "step-"] },
  { vendor: "Nvidia", color: "#76B900", prefixes: ["nvidia", "nemotron"] },
  { vendor: "Azure", color: "#0078D4", prefixes: ["azure"] },
  { vendor: "Aws", color: "#FF9900", prefixes: ["aws", "amazon", "bedrock"] },
  { vendor: "Volcengine", color: "#3370FF", prefixes: ["volcengine"] },
  { vendor: "SiliconCloud", color: "#7C3AED", prefixes: ["siliconflow"] },
  { vendor: "Groq", color: "#F55036", prefixes: ["groq"] },
  { vendor: "Together", color: "#0F6FFF", prefixes: ["together"] },
  { vendor: "Fireworks", color: "#FF6B00", prefixes: ["fireworks"] },
  { vendor: "Replicate", color: "#000000", prefixes: ["replicate"] },
  { vendor: "Ollama", color: "#FFFFFF", prefixes: ["ollama"] },
  { vendor: "OpenRouter", color: "#6366F1", prefixes: ["openrouter"] },
  { vendor: "Cloudflare", color: "#F38020", prefixes: ["cloudflare"] },
  { vendor: "Cerebras", color: "#FF5722", prefixes: ["cerebras"] },
  { vendor: "SambaNova", color: "#FF6B00", prefixes: ["sambanova"] },
  { vendor: "Novita", color: "#7C3AED", prefixes: ["novita"] },
  { vendor: "HuggingFace", color: "#FFD21E", prefixes: ["huggingface", "hf"] },
  { vendor: "Cohere", color: "#39594D", prefixes: ["cohere", "command"] },
  { vendor: "Perplexity", color: "#20B8CD", prefixes: ["perplexity"] },
  { vendor: "Microsoft", color: "#00BCF2", prefixes: ["phi-"] },
  { vendor: "KwaiKAT", color: "#1969FC", prefixes: ["kat"] },
];

const D_PATH_RE = /d:\s*("(?:[^"\\]|\\.)*")/g;

function extractPaths(vendor) {
  const file = path.join(pkgJsonPath, "../es", vendor, "components", "Mono.js");
  const src = fs.readFileSync(file, "utf8");
  const paths = [];
  D_PATH_RE.lastIndex = 0;
  let m;
  while ((m = D_PATH_RE.exec(src)) !== null) paths.push(JSON.parse(m[1]));
  if (!paths.length) {
    console.error(`[extract-model-icons] no SVG paths found in ${file}`);
    process.exit(1);
  }
  return paths;
}

const rows = ENTRIES.map(({ vendor, color, prefixes }) => ({
  prefixes,
  paths: extractPaths(vendor),
  color,
  title: vendor,
}));

const out = `// AUTO-GENERATED by scripts/extract-model-icons.mjs from @lobehub/icons.
// Do not edit by hand. Regenerate with: node scripts/extract-model-icons.mjs
export interface ModelIconEntry {
  prefixes: string[];
  /** SVG <path> d attributes (some icons use multiple paths). */
  paths: string[];
  /** Brand color used as the circular avatar background. */
  color: string;
  /** Vendor name, used as the avatar title/aria-label. */
  title: string;
}
export const MODEL_ICONS: ModelIconEntry[] = ${JSON.stringify(rows, null, 2)};
export const DEFAULT_MODEL_ICON: ModelIconEntry = ${JSON.stringify(rows[0])};
`;

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, out);
formatWithOxfmt(OUT_PATH);
console.log(`[extract-model-icons] ${rows.length} vendor icons -> ${OUT_PATH}`);
