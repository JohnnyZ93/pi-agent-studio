import chatHtml from "./chat-dist.html?raw";

function escJsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

export function getChatWebviewHtml(
  home?: string,
  sep?: string,
  fontSize?: number,
  lang?: string,
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
  return html;
}
