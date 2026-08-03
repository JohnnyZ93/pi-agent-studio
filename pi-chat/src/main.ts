// pi-chat webview entry point
import "./style.css";
import { setModelIconFns } from "./globals";
import { getModelIcon, modelIconHtml, escHtml } from "./model-icons";
import "./messages";
import "./composer";
import "./rewind";

// Wire model icon functions into globals (avoids circular imports)
setModelIconFns(getModelIcon, modelIconHtml, escHtml);

// Set the runtime font size if specified by the host
if (typeof (window as any).__PI_FONTSIZE__ === "number" && (window as any).__PI_FONTSIZE__ > 0) {
  document.documentElement.style.setProperty("--chat-fs", (window as any).__PI_FONTSIZE__ + "px");
}
