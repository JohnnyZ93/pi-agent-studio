import * as vscode from "vscode";
import { ensureSettingsJsonExists } from "./settings-config.ts";
import { collectStaticEnv, detectNodeVersion, detectPiVersion } from "./settings-env.ts";
import { getSettingsHtml } from "./settings-sidebar-html.ts";

const LINK_HOME = "https://pi.dev";
const LINK_PACKAGES = "https://pi.dev/packages";
const LINK_GITHUB = "https://github.com/JohnnyZ93/pi-agent-studio";

export function createSettingsViewProvider(): vscode.WebviewViewProvider {
  return {
    resolveWebviewView(webviewView) {
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getSettingsHtml();

      const postData = async () => {
        const env = collectStaticEnv();
        webviewView.webview.postMessage({
          type: "data",
          env: { ...env, piVersion: "(loading…)" },
          links: { home: LINK_HOME, packages: LINK_PACKAGES, github: LINK_GITHUB },
        });
        try {
          const piVersion = await detectPiVersion(env.piPath);
          webviewView.webview.postMessage({ type: "piVersion", piVersion });
        } catch {
          webviewView.webview.postMessage({ type: "piVersion", piVersion: "(unknown)" });
        }
        try {
          const nodeVersion = await detectNodeVersion(env.piPath);
          webviewView.webview.postMessage({ type: "nodeVersion", nodeVersion });
        } catch {
          webviewView.webview.postMessage({
            type: "nodeVersion",
            nodeVersion: `${process.version} (extension host)`,
          });
        }
      };

      webviewView.webview.onDidReceiveMessage(async (msg: { type?: string; content?: string }) => {
        try {
          switch (msg.type) {
            case "ready":
            case "refresh":
              await postData();
              return;

            case "openSettings":
              await vscode.commands.executeCommand("pi-agent-studio.openSettings");
              return;

            case "openSettingsJson": {
              const doc = await vscode.workspace.openTextDocument(ensureSettingsJsonExists());
              await vscode.window.showTextDocument(doc);
              return;
            }

            case "upgrade":
              await vscode.commands.executeCommand("pi-agent-studio.upgrade");
              return;
          }
        } catch (err) {
          webviewView.webview.postMessage({
            type: "error",
            message: err instanceof Error ? err.message : String(err),
          });
        }
      });

      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) void postData();
      });
    },
  };
}
