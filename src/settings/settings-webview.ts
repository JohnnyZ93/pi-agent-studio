import settingsHtml from "./settings-dist.html?raw";

function escJsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

export function getSettingsWebviewHtml(fontSize?: number, lang?: string): string {
  let html = settingsHtml;
  html = html
    .split("PI_FONTSIZE_PLACEHOLDER")
    .join(String(fontSize && fontSize > 0 ? Math.round(fontSize) : 13));
  html = html.split("PI_LANG_PLACEHOLDER").join(escJsString(lang ?? "en"));
  return html;
}
