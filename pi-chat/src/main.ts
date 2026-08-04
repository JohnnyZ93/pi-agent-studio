// pi-chat webview entry point
import codiconTtf from "@vscode/codicons/dist/codicon.ttf?inline";
import "./style.css";
import { setModelIconFns } from "./globals";
import { getModelIcon, modelIconHtml, escHtml } from "./model-icons";
import "./messages";
import "./composer";
import "./rewind";
import "./mcp-panel";

const codiconStyle = document.createElement("style");
codiconStyle.textContent =
  '@font-face{font-family:"codicon";font-display:block;src:url(' +
  codiconTtf +
  ') format("truetype")}';
document.head.prepend(codiconStyle);

setModelIconFns(getModelIcon, modelIconHtml, escHtml);

if (typeof (window as any).__PI_FONTSIZE__ === "number" && (window as any).__PI_FONTSIZE__ > 0) {
  document.documentElement.style.setProperty("--chat-fs", (window as any).__PI_FONTSIZE__ + "px");
}
