const acquireVscodeApi: any =
  typeof acquireVsCodeApi === "function"
    ? acquireVsCodeApi
    : () => ({ postMessage: () => {}, getState: () => null, setState: () => {} });

export const vscode = acquireVscodeApi();

export function el(tag: string, cls?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

export function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
