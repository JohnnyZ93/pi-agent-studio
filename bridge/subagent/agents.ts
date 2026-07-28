/**
 * Agent discovery and configuration
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";

export type AgentSource = "user" | "project" | "builtin";

export interface AgentConfig {
  name: string;
  description: string;
  tools?: string[];
  model?: string;
  systemPrompt: string;
  source: AgentSource;
  filePath: string;
  disableModelInvocation: boolean;
}

export interface AgentDiscoveryResult {
  agents: AgentConfig[];
  projectAgentsDir: string | null;
}

const AGENT_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/;

export function isValidAgentName(name: unknown): name is string {
  return typeof name === "string" && AGENT_NAME_RE.test(name);
}

function loadAgentsFromDir(dir: string, source: AgentSource): AgentConfig[] {
  const agents: AgentConfig[] = [];

  if (!fs.existsSync(dir)) {
    return agents;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return agents;
  }

  for (const entry of entries) {
    if (!entry.name.endsWith(".md")) continue;
    if (!entry.isFile() && !entry.isSymbolicLink()) continue;

    const filePath = path.join(dir, entry.name);
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(content);

    if (typeof frontmatter.name !== "string" || typeof frontmatter.description !== "string") {
      continue;
    }

    if (!AGENT_NAME_RE.test(frontmatter.name)) {
      continue;
    }

    const toolsRaw = frontmatter.tools;
    const tools =
      typeof toolsRaw === "string"
        ? toolsRaw
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean)
        : undefined;

    const disableRaw = frontmatter["disable-model-invocation"];
    const disableModelInvocation =
      disableRaw === true ||
      (typeof disableRaw === "string" && disableRaw.trim().toLowerCase() === "true");

    agents.push({
      name: frontmatter.name,
      description: frontmatter.description,
      tools: tools && tools.length > 0 ? tools : undefined,
      model: typeof frontmatter.model === "string" ? frontmatter.model : undefined,
      systemPrompt: body,
      source,
      filePath,
      disableModelInvocation,
    });
  }

  return agents;
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function findNearestProjectAgentsDir(cwd: string): string | null {
  const MAX_DEPTH = 10;
  let currentDir = cwd;
  for (let i = 0; i < MAX_DEPTH; i++) {
    const candidate = path.join(currentDir, ".pi", "agents");
    if (isDirectory(candidate)) return candidate;

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return null;
    currentDir = parentDir;
  }
  return null;
}

export function discoverAgents(cwd: string): AgentDiscoveryResult {
  const userDir = path.join(getAgentDir(), "agents");
  const projectAgentsDir = findNearestProjectAgentsDir(cwd);

  const builtinDir = process.env.PI_VSCODE_BUILTIN_AGENTS_DIR;
  const builtinAgents = builtinDir ? loadAgentsFromDir(builtinDir, "builtin") : [];
  const userAgents = loadAgentsFromDir(userDir, "user");
  const projectAgents = projectAgentsDir ? loadAgentsFromDir(projectAgentsDir, "project") : [];

  const agentMap = new Map<string, AgentConfig>();
  for (const agent of builtinAgents) agentMap.set(agent.name, agent);
  for (const agent of userAgents) agentMap.set(agent.name, agent);
  for (const agent of projectAgents) agentMap.set(agent.name, agent);

  return { agents: Array.from(agentMap.values()), projectAgentsDir };
}

export function formatAgentList(
  agents: AgentConfig[],
  maxItems: number,
): { text: string; remaining: number } {
  if (agents.length === 0) return { text: "none", remaining: 0 };
  const listed = agents.slice(0, maxItems);
  const remaining = agents.length - listed.length;
  return {
    text: listed.map((a) => `${a.name} (${a.source}): ${a.description}`).join("; "),
    remaining,
  };
}
