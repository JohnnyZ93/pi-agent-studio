import type { RenderRule } from "markdown-it/lib/renderer.mjs";
import { PI_MERMAID_THEME } from "./globals";

let mermaidReady: Promise<typeof import("mermaid")> | null = null;
let katexReady: Promise<typeof import("katex")> | null = null;
let katexCssInjected = false;
let mermaidInitialized = false;
let seq = 0;

function loadMermaid(): Promise<typeof import("mermaid")> {
  if (!mermaidReady) mermaidReady = import("mermaid");
  return mermaidReady;
}

function loadKatex(): Promise<typeof import("katex")> {
  if (!katexReady) katexReady = import("katex");
  return katexReady;
}

const MERMAID_THEMES = ["default", "dark", "forest", "neutral", "base"] as const;

type MermaidTheme = (typeof MERMAID_THEMES)[number];

function resolveTheme(configured: string): MermaidTheme {
  const v = (configured || "default").toLowerCase();
  if ((MERMAID_THEMES as readonly string[]).indexOf(v) >= 0) return v as MermaidTheme;
  return "default";
}

let mermaidTheme: MermaidTheme | null = null;

function currentMermaidTheme(): MermaidTheme {
  if (!mermaidTheme) mermaidTheme = resolveTheme(PI_MERMAID_THEME);
  return mermaidTheme;
}

function escapeCode(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mermaidFenceRule(defaultFence: RenderRule): RenderRule {
  return (tokens, idx, options, env, slf) => {
    const info = tokens[idx].info ? tokens[idx].info.trim().split(/\s+/g)[0] : "";
    if (info === "mermaid") {
      return `<div class="pi-mermaid"><pre><code>${escapeCode(
        tokens[idx].content,
      )}</code></pre></div>\n`;
    }
    return defaultFence(tokens, idx, options, env, slf);
  };
}

async function ensureKatexCss(): Promise<void> {
  if (katexCssInjected || document.getElementById("pi-katex-css")) {
    katexCssInjected = true;
    return;
  }
  const mod = await import("katex/dist/katex.min.css?inline");
  const style = document.createElement("style");
  style.id = "pi-katex-css";
  style.textContent = mod.default;
  document.head.appendChild(style);
  katexCssInjected = true;
}

export async function enhance(target: HTMLElement): Promise<void> {
  const mermaidNodes = Array.from(
    target.querySelectorAll<HTMLElement>(".pi-mermaid:not([data-r])"),
  );
  const mathNodes = Array.from(target.querySelectorAll<HTMLElement>(".pi-math:not([data-r])"));

  if (mermaidNodes.length) {
    try {
      const mermaid = (await loadMermaid()).default;
      if (!mermaidInitialized) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: currentMermaidTheme(),
        });
        mermaidInitialized = true;
      }
      for (const node of mermaidNodes) {
        node.setAttribute("data-r", "1");
        const codeEl = node.querySelector("code");
        const src = codeEl ? (codeEl.textContent ?? "") : "";
        try {
          const { svg } = await mermaid.render(`pi-mermaid-${seq++}`, src);
          node.innerHTML = svg;
        } catch {
          node.classList.add("pi-mermaid-error");
        }
      }
    } catch {
      for (const node of mermaidNodes) node.classList.add("pi-mermaid-error");
    }
  }

  if (mathNodes.length) {
    try {
      const katex = (await loadKatex()).default;
      await ensureKatexCss();
      for (const node of mathNodes) {
        node.setAttribute("data-r", "1");
        const tex = decodeURIComponent(node.getAttribute("data-tex") || "");
        try {
          node.innerHTML = katex.renderToString(tex, {
            displayMode: node.classList.contains("pi-math-block"),
            throwOnError: false,
          });
        } catch {
          node.textContent = tex;
          node.classList.add("pi-math-error");
        }
      }
    } catch {
      for (const node of mathNodes) node.classList.add("pi-math-error");
    }
  }
}

export { mermaidFenceRule };
