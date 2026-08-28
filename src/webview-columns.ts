import * as vscode from "vscode";

const PI_WEBVIEW_VIEW_TYPES = ["pi-agent-studio.chat", "pi-agent-studio.settingsPanel"];

function isPiTab(tab: vscode.Tab): boolean {
  const input = tab.input;
  return (
    input instanceof vscode.TabInputWebview &&
    PI_WEBVIEW_VIEW_TYPES.some((viewType) => input.viewType.includes(viewType))
  );
}

export function findPiColumn(): vscode.ViewColumn | undefined {
  for (const group of vscode.window.tabGroups.all) {
    if (group.tabs.some(isPiTab)) return group.viewColumn;
  }
  return undefined;
}

export function findUnusedColumn(): vscode.ViewColumn | undefined {
  const used = new Set<vscode.ViewColumn>();
  for (const group of vscode.window.tabGroups.all) {
    if (group.viewColumn !== undefined && group.tabs.length > 0) used.add(group.viewColumn);
  }
  for (let column = vscode.ViewColumn.One; column <= vscode.ViewColumn.Nine; column++) {
    if (!used.has(column)) return column;
  }
  return undefined;
}
