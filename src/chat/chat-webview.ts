import chatHtml from "./chat-dist.html?raw";
import { readFileSync, statSync } from "node:fs";
import { extname, isAbsolute } from "node:path";
import * as vscode from "vscode";

const BG_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
};
const MAX_BG_SIZE = 10 * 1024 * 1024;

export function resolveChatBackground(_webview: vscode.Webview, path?: string): string {
  if (!path || !isAbsolute(path)) return "";
  let st;
  try {
    st = statSync(path);
  } catch {
    return "";
  }
  if (!st.isFile() || st.size === 0 || st.size > MAX_BG_SIZE) return "";
  const mime = BG_MIME[extname(path).toLowerCase()];
  if (!mime) return "";
  try {
    const buf = readFileSync(path);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

function escJsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

export function getChatWebviewHtml(
  home?: string,
  sep?: string,
  fontSize?: number,
  lang?: string,
  mermaidTheme?: string,
  bgImage?: string,
  bgOpacity?: number,
  sendShortcut?: string,
): string {
  const replaceAll = (haystack: string, needle: string, value: string) =>
    haystack.split(needle).join(value);
  let html = chatHtml;
  html = replaceAll(html, "PI_HOME_PLACEHOLDER", escJsString(home ?? ""));
  html = replaceAll(html, "PI_SEP_PLACEHOLDER", escJsString(sep ?? "/"));
  html = replaceAll(
    html,
    "PI_FONTSIZE_PLACEHOLDER",
    String(fontSize && fontSize > 0 ? Math.round(fontSize) : 13),
  );
  html = replaceAll(html, "PI_LANG_PLACEHOLDER", escJsString(lang ?? "en"));
  html = replaceAll(html, "PI_MERMAID_THEME_PLACEHOLDER", escJsString(mermaidTheme ?? "default"));
  html = replaceAll(html, "PI_BG_IMAGE_PLACEHOLDER", escJsString(bgImage ?? ""));
  html = replaceAll(
    html,
    "PI_BG_OPACITY_PLACEHOLDER",
    bgOpacity != null ? String(Math.min(1, Math.max(0, bgOpacity))) : "1",
  );
  html = replaceAll(html, "PI_SENDSHORTCUT_PLACEHOLDER", escJsString(sendShortcut ?? "enter"));
  return html;
}
