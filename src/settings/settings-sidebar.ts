import * as vscode from "vscode";
import { ensureSettingsJsonExists } from "./settings-config.ts";
import { collectStaticEnv, detectPiVersion, detectSystemNodeEnv } from "./settings-env.ts";
import { isNodeVersionSupported } from "./node-version.ts";
import { getSettingsHtml } from "./settings-sidebar-html.ts";
import { t } from "../i18n.ts";

const LINK_HOME = "https://pi.dev";
const LINK_PACKAGES = "https://pi.dev/packages";
const LINK_GITHUB = "https://github.com/JohnnyZ93/pi-agent-studio";

export function createSettingsViewProvider(): vscode.WebviewViewProvider {
  return {
    resolveWebviewView(webviewView) {
      webviewView.webview.options = { enableScripts: true };
      webviewView.webview.html = getSettingsHtml();

      const langSub = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration("pi-agent-studio.language")) {
          webviewView.webview.html = getSettingsHtml();
          void postData();
        }
      });
      webviewView.onDidDispose(() => langSub.dispose());

      const postData = async () => {
        const env = collectStaticEnv();
        webviewView.webview.postMessage({
          type: "data",
          env: { ...env, piVersion: t("(loading…)") },
          links: { home: LINK_HOME, packages: LINK_PACKAGES, github: LINK_GITHUB },
          platform: process.platform,
        });
        try {
          const [piVersion, sysEnv] = await Promise.all([
            detectPiVersion(env.piPath),
            detectSystemNodeEnv(),
          ]);
          webviewView.webview.postMessage({ type: "piVersion", piVersion });
          webviewView.webview.postMessage({
            type: "envCheck",
            nodeVersion: sysEnv.nodeVersion ?? null,
            npmVersion: sysEnv.npmVersion ?? null,
            nodeSupported: sysEnv.nodeVersion ? isNodeVersionSupported(sysEnv.nodeVersion) : false,
          });
          webviewView.webview.postMessage({
            type: "nodeVersion",
            nodeVersion: sysEnv.nodeVersion ? `v${sysEnv.nodeVersion}` : "(unknown)",
          });
        } catch {
          webviewView.webview.postMessage({ type: "piVersion", piVersion: "(unknown)" });
        }
      };

      webviewView.webview.onDidReceiveMessage(
        async (msg: { type?: string; content?: string; tab?: string; query?: string }) => {
          try {
            switch (msg.type) {
              case "ready":
              case "refresh":
                await postData();
                return;

              case "openSettings":
                await vscode.commands.executeCommand(
                  "pi-agent-studio.openSettings",
                  typeof msg.tab === "string" ? msg.tab : undefined,
                );
                return;

              case "openVscodeSettings":
                await vscode.commands.executeCommand(
                  "workbench.action.openSettings",
                  typeof msg.query === "string" ? msg.query : undefined,
                );
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
        },
      );

      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) void postData();
      });
    },
  };
}
