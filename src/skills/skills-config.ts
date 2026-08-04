import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";

export type SkillScope = "user" | "project";

export interface SkillFile {
  name: string;
  description: string;
  disableModelInvocation: boolean;
  body: string;
  filePath: string;
}

export interface SkillFormData {
  name: string;
  description: string;
  disableModelInvocation: boolean;
  body: string;
}

export function getUserSkillsDir(): string {
  return join(getAgentDir(), "skills");
}

export function getProjectSkillsDir(cwd: string): string {
  return join(cwd, CONFIG_DIR_NAME, "skills");
}

export function getUserAgentsSkillsDir(): string {
  return join(homedir(), ".agents", "skills");
}

export function getProjectAgentsSkillsDir(cwd: string): string {
  return join(cwd, ".agents", "skills");
}

export function isValidSkillName(name: string): boolean {
  if (!name || name.length > 64) return false;
  if (!/^[a-z0-9-]+$/.test(name)) return false;
  if (name.startsWith("-") || name.endsWith("-")) return false;
  if (name.includes("--")) return false;
  return true;
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

function parseDisableModelInvocation(frontmatter: Record<string, unknown>): boolean {
  const raw = frontmatter["disable-model-invocation"];
  return raw === true || (typeof raw === "string" && raw.trim().toLowerCase() === "true");
}

export function readSkillBody(filePath: string): string {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
  const { body } = parseFrontmatter<Record<string, unknown>>(content);
  return body;
}

export function readSkillFile(filePath: string): SkillFile | null {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  const { frontmatter, body } = parseFrontmatter<Record<string, unknown>>(content);
  const name = typeof frontmatter.name === "string" ? frontmatter.name : "";
  const description = typeof frontmatter.description === "string" ? frontmatter.description : "";
  return {
    name,
    description,
    disableModelInvocation: parseDisableModelInvocation(frontmatter),
    body,
    filePath,
  };
}

function serializeNewSkill(data: SkillFormData): string {
  const lines: string[] = ["---"];
  lines.push(`name: ${data.name}`);
  lines.push(`description: ${yamlDoubleQuote(data.description)}`);
  if (data.disableModelInvocation) lines.push("disable-model-invocation: true");
  lines.push("---");
  lines.push(data.body);
  return `${lines.join("\n")}\n`;
}

const NAME_LINE_RE = /^name\s*:/;
const DESC_LINE_RE = /^description\s*:/;
const DISABLE_LINE_RE = /^disable-model-invocation\s*:/;

function patchSkillRaw(existingRaw: string, data: SkillFormData): string {
  const lines = existingRaw.split(/\r?\n/);
  let fmEnd = -1;
  const first = lines[0];
  if (first && first.trim() === "---") {
    for (let i = 1; i < lines.length; i++) {
      const cur = lines[i];
      if (cur && cur.trim() === "---") {
        fmEnd = i;
        break;
      }
    }
  }
  if (fmEnd === -1) return serializeNewSkill(data);

  const fmLines = lines.slice(1, fmEnd);

  const newFm: string[] = [];
  let sawDesc = false;
  let sawName = false;
  for (const line of fmLines) {
    if (NAME_LINE_RE.test(line)) {
      newFm.push(`name: ${data.name}`);
      sawName = true;
    } else if (DESC_LINE_RE.test(line)) {
      newFm.push(`description: ${yamlDoubleQuote(data.description)}`);
      sawDesc = true;
    } else if (DISABLE_LINE_RE.test(line)) {
      if (data.disableModelInvocation) newFm.push("disable-model-invocation: true");
    } else {
      newFm.push(line);
    }
  }

  if (!sawName) {
    const nameLine = `name: ${data.name}`;
    if (newFm.length > 0) newFm.unshift(nameLine);
    else newFm.push(nameLine);
  }
  if (!sawDesc) {
    const descLine = `description: ${yamlDoubleQuote(data.description)}`;
    const nameIdx = newFm.findIndex((l) => NAME_LINE_RE.test(l));
    if (nameIdx >= 0) newFm.splice(nameIdx + 1, 0, descLine);
    else newFm.splice(1, 0, descLine);
  }
  if (data.disableModelInvocation && !newFm.some((l) => DISABLE_LINE_RE.test(l))) {
    newFm.push("disable-model-invocation: true");
  }

  const out = ["---", ...newFm, "---", data.body];
  return `${out.join("\n")}\n`;
}

function isUnderDir(path: string, dir: string): boolean {
  const p = resolve(path);
  const d = resolve(dir);
  return p === d || p.startsWith(d + sep);
}

export function classifySkillScope(filePath: string, projectDir?: string): SkillScope | null {
  if (isUnderDir(filePath, getUserSkillsDir()) || isUnderDir(filePath, getUserAgentsSkillsDir())) {
    return "user";
  }
  if (
    projectDir &&
    (isUnderDir(filePath, getProjectSkillsDir(projectDir)) ||
      isUnderDir(filePath, getProjectAgentsSkillsDir(projectDir)))
  ) {
    return "project";
  }
  return null;
}

function canonicalScopeDir(scope: SkillScope, projectDir?: string): string {
  if (scope === "project") {
    if (!projectDir) throw new Error("Project directory required for project scope");
    return getProjectSkillsDir(projectDir);
  }
  return getUserSkillsDir();
}

export function createSkill(
  data: SkillFormData,
  scope: SkillScope = "user",
  projectDir?: string,
): SkillFile {
  if (!isValidSkillName(data.name)) throw new Error(`Invalid skill name: ${data.name}`);
  if (!data.description.trim()) throw new Error("Description is required");

  const baseDir = ensureDir(canonicalScopeDir(scope, projectDir));
  const skillDir = join(baseDir, data.name);
  if (existsSync(skillDir)) throw new Error(`Skill already exists: ${data.name}`);
  mkdirSync(skillDir, { recursive: true });
  const filePath = join(skillDir, "SKILL.md");
  writeFileSync(filePath, serializeNewSkill(data), "utf8");

  const parsed = readSkillFile(filePath);
  if (!parsed) throw new Error(`Failed to write skill: ${data.name}`);
  return parsed;
}

export function updateSkill(filePath: string, data: SkillFormData, projectDir?: string): SkillFile {
  if (!isValidSkillName(data.name)) throw new Error(`Invalid skill name: ${data.name}`);
  if (!data.description.trim()) throw new Error("Description is required");
  if (classifySkillScope(filePath, projectDir) === null) {
    throw new Error("Skill is not in a writable location");
  }
  if (!existsSync(filePath)) throw new Error(`Skill file not found: ${filePath}`);

  const content = patchSkillRaw(readFileSync(filePath, "utf-8"), data);
  writeFileSync(filePath, content, "utf8");

  const parsed = readSkillFile(filePath);
  if (!parsed) throw new Error(`Failed to write skill: ${data.name}`);
  return parsed;
}

export function deleteSkill(baseDir: string, projectDir?: string): void {
  if (classifySkillScope(baseDir, projectDir) === null) {
    throw new Error("Skill is not in a writable location");
  }
  if (!existsSync(baseDir)) throw new Error(`Skill not found: ${baseDir}`);
  rmSync(baseDir, { recursive: true, force: true });
}
