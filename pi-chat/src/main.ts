// pi-chat webview entry point
import codiconTtf from "@vscode/codicons/dist/codicon.ttf?inline";
import "./style.css";
import { setModelIconFns, vscode } from "./globals";
import { getModelIcon, modelIconHtml, escHtml } from "./model-icons";
import { t } from "./i18n";
import "./messages";
import "./composer";
import "./rewind";
import "./mcp-panel";
import { initTimeline } from "./timeline";

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

const piBgImage = (window as any).__PI_BG_IMAGE__;
if (piBgImage) {
  document.documentElement.style.setProperty(
    "--pi-bg-image",
    `url("${String(piBgImage).replace(/"/g, '\\"')}")`,
  );
  document.documentElement.style.setProperty("--pi-bg-blur", "blur(8px)");
  document.documentElement.style.setProperty("--pi-bg-on", "1");
}
const piBgOpacity = (window as any).__PI_BG_OPACITY__;
if (typeof piBgOpacity === "number") {
  document.documentElement.style.setProperty(
    "--pi-bg-opacity",
    String(Math.min(1, Math.max(0, piBgOpacity))),
  );
}

const inputEl = document.getElementById("input") as HTMLTextAreaElement | null;
if (inputEl) {
  inputEl.placeholder = t("Ask anything…  (use / for commands, @ for files)");
}
const modelSearchEl = document.getElementById("model-search") as HTMLInputElement | null;
if (modelSearchEl) {
  modelSearchEl.placeholder = t("Search models…");
}
const scrollBtn = document.getElementById("scroll-bottom-btn");
if (scrollBtn) scrollBtn.title = t("Scroll to bottom");
const ctxCopy = document.getElementById("ctx-copy");
if (ctxCopy) ctxCopy.textContent = t("Copy");
const ctxFork = document.getElementById("ctx-fork");
if (ctxFork) ctxFork.textContent = t("Fork from here");
const ctxRevert = document.getElementById("ctx-revert");
if (ctxRevert) ctxRevert.textContent = t("Revert here");

initTimeline();

window.addEventListener("load", () => {
  vscode.postMessage({ type: "webviewReady" });
});
