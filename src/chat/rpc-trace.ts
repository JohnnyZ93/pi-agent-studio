import * as vscode from "vscode";

const CHANNEL_NAME = "Pi Chat RPC";
let channel: vscode.OutputChannel | undefined;

function isEnabled(): boolean {
  return vscode.workspace.getConfiguration("pi-agent-studio").get<boolean>("rpcTrace") ?? false;
}

function getChannel(): vscode.OutputChannel {
  if (!channel) channel = vscode.window.createOutputChannel(CHANNEL_NAME);
  return channel;
}

export function rpcTrace(tag: string, direction: "out" | "in", line: string): void {
  if (!isEnabled()) return;
  const arrow = direction === "out" ? "->" : "<-";
  getChannel().appendLine(`[${tag}] ${arrow} ${line}`);
}

export function rpcTraceErr(tag: string, line: string): void {
  if (!isEnabled()) return;
  getChannel().appendLine(`[${tag}] [err] ${line}`);
}

export function disposeRpcTrace(): void {
  channel?.dispose();
  channel = undefined;
}
