import fs from "node:fs";
import chatHtml from "./chat-dist.html?raw";

let codiconBase64Cache: string | null = null;
function loadCodiconBase64(ttfPath?: string): string {
  if (codiconBase64Cache !== null) return codiconBase64Cache;
  codiconBase64Cache = "";
  if (ttfPath) {
    try {
      codiconBase64Cache = fs.readFileSync(ttfPath).toString("base64");
    } catch {}
  }
  return codiconBase64Cache;
}

function escJsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

export function getChatWebviewHtml(
  home?: string,
  sep?: string,
  fontSize?: number,
  codiconTtfPath?: string,
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
  html = replaceAll(html, "PI_CODICON_BASE64_PLACEHOLDER", loadCodiconBase64(codiconTtfPath));
  return html;
}
