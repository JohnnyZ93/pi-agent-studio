import settingsHtml from "./settings-dist.html?raw";

export function getSettingsWebviewHtml(fontSize?: number): string {
  let html = settingsHtml;
  html = html
    .split("PI_FONTSIZE_PLACEHOLDER")
    .join(String(fontSize && fontSize > 0 ? Math.round(fontSize) : 13));
  return html;
}
