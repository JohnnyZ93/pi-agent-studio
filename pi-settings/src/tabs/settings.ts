import { vscode } from "../globals";

interface SettingsData {
  values: Record<string, any>;
}

interface SettingField {
  key: string;
  label: string;
  type: "bool" | "enum" | "number" | "string" | "string[]" | "json";
  desc?: string;
  options?: string[];
  def?: unknown;
  placeholder?: string;
  min?: number;
  max?: number;
}

interface SettingGroup {
  title: string;
  fields: SettingField[];
}

const GROUPS: SettingGroup[] = [
  {
    title: "Model & Thinking",
    fields: [
      { key: "defaultProvider", label: "Default provider", type: "string", placeholder: "anthropic" },
      { key: "defaultModel", label: "Default model", type: "string", placeholder: "claude-sonnet-4-20250514" },
      {
        key: "defaultThinkingLevel",
        label: "Default thinking level",
        type: "enum",
        options: ["off", "minimal", "low", "medium", "high", "xhigh", "max"],
      },
      { key: "hideThinkingBlock", label: "Hide thinking block", type: "bool", desc: "Hide thinking blocks in output" },
      {
        key: "showCacheMissNotices",
        label: "Show cache-miss notices",
        type: "bool",
        desc: "Show transcript notices for significant prompt-cache misses",
      },
      {
        key: "thinkingBudgets",
        label: "Thinking budgets",
        type: "json",
        desc: 'Custom token budgets per thinking level, e.g. {"low": 4096}',
      },
    ],
  },
  {
    title: "UI & Display",
    fields: [
      { key: "theme", label: "Theme", type: "string", def: "dark", placeholder: "dark" },
      { key: "externalEditor", label: "External editor", type: "string", desc: 'Command for Ctrl+G external editor (e.g. "code --wait")' },
      { key: "quietStartup", label: "Quiet startup", type: "bool", desc: "Hide startup header" },
      {
        key: "defaultProjectTrust",
        label: "Default project trust",
        type: "enum",
        options: ["ask", "always", "never"],
        desc: "Fallback project trust behavior (global only)",
      },
      { key: "collapseChangelog", label: "Collapse changelog", type: "bool", desc: "Show condensed changelog after updates" },
      { key: "enableInstallTelemetry", label: "Install telemetry", type: "bool", def: true },
      { key: "enableAnalytics", label: "Analytics", type: "bool", desc: "Opt-in analytics data sharing" },
      { key: "trackingId", label: "Tracking ID", type: "string" },
      { key: "doubleEscapeAction", label: "Double-escape action", type: "enum", options: ["tree", "fork", "none"], def: "tree" },
      {
        key: "treeFilterMode",
        label: "Tree filter mode",
        type: "enum",
        options: ["default", "no-tools", "user-only", "labeled-only", "all"],
        def: "default",
      },
      { key: "editorPaddingX", label: "Editor padding X", type: "number", min: 0, max: 3, def: 0 },
      { key: "outputPad", label: "Output pad", type: "number", min: 0, max: 1, def: 1 },
      { key: "autocompleteMaxVisible", label: "Autocomplete max visible", type: "number", min: 3, max: 20, def: 5 },
      {
        key: "showHardwareCursor",
        label: "Show hardware cursor",
        type: "bool",
        desc: "Show the terminal cursor while TUI positions it for IME support",
      },
    ],
  },
  {
    title: "Network",
    fields: [
      {
        key: "httpProxy",
        label: "HTTP proxy",
        type: "string",
        placeholder: "http://127.0.0.1:7890",
        desc: "Applied as HTTP_PROXY and HTTPS_PROXY (global only)",
      },
    ],
  },
  {
    title: "Warnings",
    fields: [
      {
        key: "warnings.anthropicExtraUsage",
        label: "Anthropic extra usage warning",
        type: "bool",
        def: true,
        desc: "Show a warning when Anthropic subscription auth may use paid extra usage",
      },
    ],
  },
  {
    title: "Compaction",
    fields: [
      { key: "compaction.enabled", label: "Enabled", type: "bool", def: true, desc: "Enable auto-compaction" },
      { key: "compaction.reserveTokens", label: "Reserve tokens", type: "number", def: 16384, desc: "Tokens reserved for LLM response" },
      { key: "compaction.keepRecentTokens", label: "Keep recent tokens", type: "number", def: 20000, desc: "Recent tokens to keep (not summarized)" },
    ],
  },
  {
    title: "Branch Summary",
    fields: [
      { key: "branchSummary.reserveTokens", label: "Reserve tokens", type: "number", def: 16384, desc: "Tokens reserved for branch summarization" },
      {
        key: "branchSummary.skipPrompt",
        label: "Skip prompt",
        type: "bool",
        desc: 'Skip "Summarize branch?" prompt on /tree navigation',
      },
    ],
  },
  {
    title: "Retry",
    fields: [
      { key: "retry.enabled", label: "Enabled", type: "bool", def: true, desc: "Enable automatic agent-level retry on transient errors" },
      { key: "retry.maxRetries", label: "Max retries", type: "number", def: 3 },
      { key: "retry.baseDelayMs", label: "Base delay (ms)", type: "number", def: 2000, desc: "Exponential backoff base (2s, 4s, 8s)" },
      { key: "retry.provider.timeoutMs", label: "Provider timeout (ms)", type: "number" },
      { key: "retry.provider.maxRetries", label: "Provider max retries", type: "number", def: 0 },
      { key: "retry.provider.maxRetryDelayMs", label: "Provider max retry delay (ms)", type: "number", def: 60000 },
    ],
  },
  {
    title: "Message Delivery",
    fields: [
      { key: "steeringMode", label: "Steering mode", type: "enum", options: ["all", "one-at-a-time"], def: "one-at-a-time" },
      { key: "followUpMode", label: "Follow-up mode", type: "enum", options: ["all", "one-at-a-time"], def: "one-at-a-time" },
      { key: "transport", label: "Transport", type: "enum", options: ["sse", "websocket", "websocket-cached", "auto"], def: "auto" },
      { key: "httpIdleTimeoutMs", label: "HTTP idle timeout (ms)", type: "number", def: 300000 },
      { key: "websocketConnectTimeoutMs", label: "WebSocket connect timeout (ms)", type: "number", def: 15000 },
    ],
  },
  {
    title: "Terminal & Images",
    fields: [
      { key: "terminal.showImages", label: "Show images in terminal", type: "bool", def: true },
      { key: "terminal.imageWidthCells", label: "Image width (cells)", type: "number", def: 60 },
      { key: "terminal.clearOnShrink", label: "Clear on shrink", type: "bool", desc: "Clear empty rows when content shrinks" },
      { key: "images.autoResize", label: "Auto-resize images", type: "bool", def: true, desc: "Resize images to 2000x2000 max" },
      { key: "images.blockImages", label: "Block images", type: "bool", desc: "Block all images from being sent to the LLM" },
    ],
  },
  {
    title: "Shell",
    fields: [
      { key: "shellPath", label: "Shell path", type: "string", desc: "Custom shell path (e.g. for Cygwin on Windows)" },
      { key: "shellCommandPrefix", label: "Command prefix", type: "string", desc: 'Prefix for every bash command (e.g. "shopt -s expand_aliases")' },
      { key: "npmCommand", label: "npm command", type: "string[]", desc: "Command argv for npm operations (one entry per line)" },
    ],
  },
  {
    title: "Sessions",
    fields: [{ key: "sessionDir", label: "Session directory", type: "string", placeholder: ".pi/sessions" }],
  },
  {
    title: "Model Cycling",
    fields: [
      {
        key: "enabledModels",
        label: "Enabled models",
        type: "string[]",
        desc: "Model patterns for Ctrl+P cycling (one per line, globs like claude-* supported)",
      },
    ],
  },
  {
    title: "Markdown",
    fields: [{ key: "markdown.codeBlockIndent", label: "Code block indent", type: "string", def: "  " }],
  },
  {
    title: "Resources",
    fields: [
      { key: "packages", label: "Packages", type: "json", desc: "npm/git packages to load resources from (JSON array)" },
      { key: "extensions", label: "Extensions", type: "string[]", desc: "Local extension file paths or directories (one per line)" },
      { key: "skills", label: "Skills", type: "string[]", desc: "Local skill file paths or directories (one per line)" },
      { key: "prompts", label: "Prompts", type: "string[]", desc: "Local prompt template paths or directories (one per line)" },
      { key: "themes", label: "Themes", type: "string[]", desc: "Local theme file paths or directories (one per line)" },
      { key: "enableSkillCommands", label: "Enable skill commands", type: "bool", def: true, desc: "Register skills as /skill:name commands" },
    ],
  },
];

export function renderSettingsTab(parent: HTMLElement, data: SettingsData) {
  const values = (data.values ?? {}) as Record<string, any>;
  const initial = new Map<string, unknown>();

  function fieldHtml(f: SettingField): string {
    const init = getAt(values, f.key) ?? f.def;
    initial.set(f.key, init);
    const id = "cfg-" + cssKey(f.key);
    const desc = f.desc ? `<div class="cfg-desc">${escHtml(f.desc)}</div>` : "";
    switch (f.type) {
      case "bool":
        return `<div class="cfg-field"><label class="check-label"><input type="checkbox" id="${id}" data-key="${escHtml(f.key)}" ${init ? "checked" : ""} /> ${escHtml(f.label)}</label>${desc}</div>`;
      case "enum":
        return `<div class="cfg-field"><label class="field-label" for="${id}">${escHtml(f.label)}</label><select id="${id}" data-key="${escHtml(f.key)}">${(f.options ?? [])
          .map((o) => `<option value="${escHtml(o)}" ${o === init ? "selected" : ""}>${escHtml(o)}</option>`)
          .join("")}</select>${desc}</div>`;
      case "number":
        return `<div class="cfg-field"><label class="field-label" for="${id}">${escHtml(f.label)}</label><input type="number" id="${id}" data-key="${escHtml(f.key)}" value="${init === undefined ? "" : String(init)}"${f.min !== undefined ? ` min="${f.min}"` : ""}${f.max !== undefined ? ` max="${f.max}"` : ""} />${desc}</div>`;
      case "string":
        return `<div class="cfg-field"><label class="field-label" for="${id}">${escHtml(f.label)}</label><input id="${id}" data-key="${escHtml(f.key)}" value="${escHtml(String(init ?? ""))}"${f.placeholder ? ` placeholder="${escHtml(f.placeholder)}"` : ""} />${desc}</div>`;
      case "string[]": {
        const arr = Array.isArray(init) ? (init as unknown[]) : [];
        return `<div class="cfg-field"><label class="field-label" for="${id}">${escHtml(f.label)}</label><textarea id="${id}" class="ta" data-key="${escHtml(f.key)}" rows="3" spellcheck="false">${escHtml(arr.map(String).join("\n"))}</textarea>${desc}</div>`;
      }
      case "json": {
        const s = JSON.stringify(init ?? f.def);
        const text = s === undefined ? "" : s;
        return `<div class="cfg-field"><label class="field-label" for="${id}">${escHtml(f.label)}</label><textarea id="${id}" class="ta" data-key="${escHtml(f.key)}" rows="4" spellcheck="false">${escHtml(text)}</textarea>${desc}</div>`;
      }
    }
  }

  parent.innerHTML = /* html */ `
<div class="tab-section">
  <div class="cfg-search-row">
    <input id="cfg-search" class="cfg-search" placeholder="Search settings…" />
    <button class="btn-primary" data-action="save-settings"><span class="codicon codicon-save"></span> Save</button>
    <button class="btn-secondary" data-action="open-settings-file" title="Open settings.json"><span class="codicon codicon-go-to-file"></span> settings.json</button>
  </div>
  <div id="cfg-error"></div>
  <div id="cfg-groups">
    ${GROUPS.map(
      (g, gi) => `
    <div class="cfg-group" data-gi="${gi}">
      <div class="cfg-group-header">
        <span class="codicon codicon-chevron-down"></span>
        <span>${escHtml(g.title)}</span>
        <button class="btn-icon cfg-reset" data-action="reset-group" data-gi="${gi}" title="Reset to defaults"><span class="codicon codicon-discard"></span></button>
        <span class="cfg-dirty-dot" hidden>●</span>
      </div>
      <div class="cfg-group-body">${g.fields.map(fieldHtml).join("")}</div>
    </div>`,
    ).join("")}
  </div>
</div>`;

  function currentValue(f: SettingField): { dirty: boolean; value: unknown; error?: boolean } {
    const el = document.getElementById("cfg-" + cssKey(f.key)) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null;
    if (!el) return { dirty: false, value: undefined };
    const init = initial.get(f.key);
    switch (f.type) {
      case "bool": {
        const v = (el as HTMLInputElement).checked;
        return { dirty: v !== !!init, value: v };
      }
      case "enum":
      case "string": {
        const v = el.value;
        return { dirty: v !== String(init ?? ""), value: v };
      }
      case "number": {
        const raw = el.value;
        if (raw === "") {
          const has = init !== undefined && init !== null;
          return { dirty: has, value: undefined };
        }
        const v = Number(raw);
        return { dirty: v !== Number(init), value: v };
      }
      case "string[]": {
        const v = (el as HTMLTextAreaElement).value
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        const i = Array.isArray(init) ? init.map(String) : [];
        const same = v.length === i.length && v.every((x, n) => x === i[n]);
        return { dirty: !same, value: v };
      }
      case "json": {
        const raw = (el as HTMLTextAreaElement).value.trim();
        if (raw === "") {
          const has = init !== undefined && init !== null;
          return { dirty: has, value: undefined };
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return { dirty: true, value: undefined, error: true };
        }
        const same = JSON.stringify(parsed) === JSON.stringify(init ?? null);
        return { dirty: !same, value: parsed };
      }
    }
  }

  function collectPatch(): { patch: Record<string, any>; error?: string } {
    const patch: Record<string, any> = {};
    for (const g of GROUPS) {
      for (const f of g.fields) {
        const r = currentValue(f);
        if (!r.dirty) continue;
        if (r.error) {
          return { patch: {}, error: `Invalid JSON in "${f.label}"` };
        }
        setAt(patch, f.key, r.value);
      }
    }
    return { patch };
  }

  function updateDirtyDots() {
    const dirty = new Set<string>();
    for (const g of GROUPS) {
      for (const f of g.fields) {
        if (currentValue(f).dirty) dirty.add(f.key);
      }
    }
    document.querySelectorAll<HTMLElement>(".cfg-group").forEach((g) => {
      const gi = Number(g.dataset.gi);
      const dot = g.querySelector<HTMLElement>(".cfg-dirty-dot");
      if (dot) dot.hidden = !GROUPS[gi].fields.some((f) => dirty.has(f.key));
    });
  }

  function filterGroups(q: string) {
    const norm = q.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>(".cfg-group").forEach((g) => {
      const group = GROUPS[Number(g.dataset.gi)];
      const match =
        !norm ||
        group.title.toLowerCase().includes(norm) ||
        group.fields.some(
          (f) => f.label.toLowerCase().includes(norm) || f.key.toLowerCase().includes(norm),
        );
      g.classList.toggle("hidden", !match);
      g.classList.toggle("open", !!norm && match);
    });
  }

  function resetGroup(gi: number) {
    for (const f of GROUPS[gi].fields) {
      const el = document.getElementById("cfg-" + cssKey(f.key)) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null;
      if (!el) continue;
      switch (f.type) {
        case "bool":
          (el as HTMLInputElement).checked = !!f.def;
          break;
        case "enum":
          el.value = String(f.def ?? "");
          break;
        case "number":
          (el as HTMLInputElement).value = f.def === undefined ? "" : String(f.def);
          break;
        case "string":
          (el as HTMLInputElement).value = String(f.def ?? "");
          break;
        case "string[]":
          (el as HTMLTextAreaElement).value = Array.isArray(f.def) ? f.def.map(String).join("\n") : "";
          break;
        case "json": {
          const s = JSON.stringify(f.def);
          (el as HTMLTextAreaElement).value = s === undefined ? "" : s;
          break;
        }
      }
    }
    updateDirtyDots();
  }

  parent.addEventListener("click", (e) => {
    const resetBtn = (e.target as HTMLElement).closest<HTMLElement>("[data-action='reset-group']");
    if (resetBtn) {
      const gi = Number(resetBtn.getAttribute("data-gi"));
      if (!Number.isNaN(gi)) resetGroup(gi);
      return;
    }
    const header = (e.target as HTMLElement).closest<HTMLElement>(".cfg-group-header");
    if (header) {
      header.parentElement?.classList.toggle("open");
      return;
    }
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!btn) return;
    if (btn.getAttribute("data-action") === "save-settings") {
      const { patch, error } = collectPatch();
      const errHost = document.getElementById("cfg-error");
      if (errHost) errHost.innerHTML = "";
      if (error && errHost) {
        errHost.innerHTML = `<div class="error">${escHtml(error)}</div>`;
        return;
      }
      if (Object.keys(patch).length === 0) return;
      vscode.postMessage({ type: "saveSettings", patch });
    } else if (btn.getAttribute("data-action") === "open-settings-file") {
      vscode.postMessage({ type: "openSettingsFile" });
    }
  });

  parent.addEventListener("input", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "cfg-search") {
      filterGroups((t as HTMLInputElement).value);
      return;
    }
    if (t.hasAttribute("data-key")) updateDirtyDots();
  });

  parent.addEventListener("change", (e) => {
    if ((e.target as HTMLElement).hasAttribute("data-key")) updateDirtyDots();
  });
}

function getAt(obj: Record<string, any>, path: string): unknown {
  let cur: any = obj;
  for (const part of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = cur[part];
  }
  return cur;
}

function setAt(obj: Record<string, any>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] === null || Array.isArray(cur[p])) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function cssKey(key: string): string {
  return key.replace(/\./g, "-");
}

function escHtml(s: string): string {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
