import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";

export type PromptScope = "user" | "project";

export interface PromptFile {
  name: string;
  description: string;
  argumentHint?: string;
  content: string;
  source: PromptScope;
  filePath: string;
}

export interface PromptFormData {
  name: string;
  description: string;
  argumentHint?: string;
  content: string;
}

const PROMPT_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/;

export function isValidPromptName(name: string): boolean {
  return PROMPT_NAME_RE.test(name);
}

export function getUserPromptsDir(): string {
  return join(getAgentDir(), "prompts");
}

export function getProjectPromptsDir(cwd: string): string {
  return join(cwd, CONFIG_DIR_NAME, "prompts");
}

function ensureDir(dir: string): string {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function yamlDoubleQuote(s: string): string {
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

export function serializePrompt(data: PromptFormData): string {
  const lines: string[] = ["---"];
  lines.push(`description: ${yamlDoubleQuote(data.description)}`);
  if (data.argumentHint) lines.push(`argument-hint: ${yamlDoubleQuote(data.argumentHint)}`);
  lines.push("---");
  lines.push(data.content);
  return `${lines.join("\n")}\n`;
}

export function parsePromptFile(filePath: string, source: PromptScope): PromptFile | null {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(content);
  if (typeof frontmatter.description !== "string") return null;
  const name = filePath.split(/[\\/]/).pop()?.replace(/\.md$/, "");
  if (!name || !PROMPT_NAME_RE.test(name)) return null;

  const argumentHintRaw = frontmatter["argument-hint"];
  return {
    name,
    description: frontmatter.description,
    argumentHint: typeof argumentHintRaw === "string" ? argumentHintRaw : undefined,
    content: body,
    source,
    filePath,
  };
}

function scopeDir(scope: PromptScope, projectDir?: string): string {
  if (scope === "project") {
    if (!projectDir) throw new Error("Project directory required for project scope");
    return getProjectPromptsDir(projectDir);
  }
  return getUserPromptsDir();
}

function scopePromptPath(name: string, scope: PromptScope, projectDir?: string): string {
  return join(scopeDir(scope, projectDir), `${name}.md`);
}

export function nameExistsInScope(name: string, scope: PromptScope, projectDir?: string): boolean {
  return existsSync(scopePromptPath(name, scope, projectDir));
}

export function writePrompt(
  name: string,
  data: PromptFormData,
  scope: PromptScope = "user",
  projectDir?: string,
  isNew = false,
): PromptFile {
  if (!isValidPromptName(name)) throw new Error(`Invalid prompt name: ${name}`);
  if (data.name !== name) throw new Error(`Prompt name mismatch: ${name} vs ${data.name}`);

  const dir = ensureDir(scopeDir(scope, projectDir));
  const filePath = join(dir, `${name}.md`);
  if (isNew && existsSync(filePath)) throw new Error(`Prompt already exists: ${name}`);
  writeFileSync(filePath, serializePrompt(data), "utf8");

  const parsed = parsePromptFile(filePath, scope);
  if (!parsed) throw new Error(`Failed to write prompt: ${name}`);
  return parsed;
}

export function deletePrompt(name: string, scope: PromptScope = "user", projectDir?: string): void {
  if (!isValidPromptName(name)) throw new Error(`Invalid prompt name: ${name}`);
  const filePath = scopePromptPath(name, scope, projectDir);
  if (!existsSync(filePath)) throw new Error(`Prompt not found: ${name}`);
  rmSync(filePath, { force: true });
}
