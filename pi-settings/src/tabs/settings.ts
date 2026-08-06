import { vscode } from "../globals";
import { t } from "../i18n";

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
    title: t("Model & Thinking"),
    fields: [
      {
        key: "defaultProvider",
        label: t("Default provider"),
        type: "string",
        placeholder: "anthropic",
      },
      {
        key: "defaultModel",
        label: t("Default model"),
        type: "string",
        placeholder: "claude-sonnet-4-20250514",
      },
      {
        key: "defaultThinkingLevel",
        label: t("Default thinking level"),
        type: "enum",
        options: ["off", "minimal", "low", "medium", "high", "xhigh", "max"],
      },
      {
        key: "hideThinkingBlock",
        label: t("Hide thinking block"),
        type: "bool",
        desc: t("Hide thinking blocks in output"),
      },
      {
        key: "showCacheMissNotices",
        label: t("Show cache-miss notices"),
        type: "bool",
        desc: t("Show transcript notices for significant prompt-cache misses"),
      },
      {
        key: "thinkingBudgets",
        label: t("Thinking budgets"),
        type: "json",
        desc: t('Custom token budgets per thinking level, e.g. {"low": 4096}'),
      },
    ],
  },
  {
    title: t("UI & Display"),
    fields: [
      { key: "theme", label: t("Theme"), type: "string", def: "dark", placeholder: "dark" },
      {
        key: "externalEditor",
        label: t("External editor"),
        type: "string",
        desc: t('Command for Ctrl+G external editor (e.g. "code --wait")'),
      },
      {
        key: "quietStartup",
        label: t("Quiet startup"),
        type: "bool",
        desc: t("Hide startup header"),
      },
      {
        key: "defaultProjectTrust",
        label: t("Default project trust"),
        type: "enum",
        options: ["ask", "always", "never"],
        desc: t("Fallback project trust behavior (global only)"),
      },
      {
        key: "collapseChangelog",
        label: t("Collapse changelog"),
        type: "bool",
        desc: t("Show condensed changelog after updates"),
      },
      { key: "enableInstallTelemetry", label: t("Install telemetry"), type: "bool", def: true },
      {
        key: "enableAnalytics",
        label: t("Analytics"),
        type: "bool",
        desc: t("Opt-in analytics data sharing"),
      },
      { key: "trackingId", label: t("Tracking ID"), type: "string" },
      {
        key: "doubleEscapeAction",
        label: t("Double-escape action"),
        type: "enum",
        options: ["tree", "fork", "none"],
        def: "tree",
      },
      {
        key: "treeFilterMode",
        label: t("Tree filter mode"),
        type: "enum",
        options: ["default", "no-tools", "user-only", "labeled-only", "all"],
        def: "default",
      },
      {
        key: "editorPaddingX",
        label: t("Editor padding X"),
        type: "number",
        min: 0,
        max: 3,
        def: 0,
      },
      { key: "outputPad", label: t("Output pad"), type: "number", min: 0, max: 1, def: 1 },
      {
        key: "autocompleteMaxVisible",
        label: t("Autocomplete max visible"),
        type: "number",
        min: 3,
        max: 20,
        def: 5,
      },
      {
        key: "showHardwareCursor",
        label: t("Show hardware cursor"),
        type: "bool",
        desc: t("Show the terminal cursor while TUI positions it for IME support"),
      },
    ],
  },
  {
    title: t("Network"),
    fields: [
      {
        key: "httpProxy",
        label: t("HTTP proxy"),
        type: "string",
        placeholder: "http://127.0.0.1:7890",
        desc: t("Applied as HTTP_PROXY and HTTPS_PROXY (global only)"),
      },
    ],
  },
  {
    title: t("Warnings"),
    fields: [
      {
        key: "warnings.anthropicExtraUsage",
        label: t("Anthropic extra usage warning"),
        type: "bool",
        def: true,
        desc: t("Show a warning when Anthropic subscription auth may use paid extra usage"),
      },
    ],
  },
  {
    title: t("Compaction"),
    fields: [
      {
        key: "compaction.enabled",
        label: t("Enabled"),
        type: "bool",
        def: true,
        desc: t("Enable auto-compaction"),
      },
      {
        key: "compaction.reserveTokens",
        label: t("Reserve tokens"),
        type: "number",
        def: 16384,
        desc: t("Tokens reserved for LLM response"),
      },
      {
        key: "compaction.keepRecentTokens",
        label: t("Keep recent tokens"),
        type: "number",
        def: 20000,
        desc: t("Recent tokens to keep (not summarized)"),
      },
    ],
  },
  {
    title: t("Branch Summary"),
    fields: [
      {
        key: "branchSummary.reserveTokens",
        label: t("Reserve tokens"),
        type: "number",
        def: 16384,
        desc: t("Tokens reserved for branch summarization"),
      },
      {
        key: "branchSummary.skipPrompt",
        label: t("Skip prompt"),
        type: "bool",
        desc: t('Skip "Summarize branch?" prompt on /tree navigation'),
      },
    ],
  },
  {
    title: t("Retry"),
    fields: [
      {
        key: "retry.enabled",
        label: t("Enabled"),
        type: "bool",
        def: true,
        desc: t("Enable automatic agent-level retry on transient errors"),
      },
      { key: "retry.maxRetries", label: t("Max retries"), type: "number", def: 3 },
      {
        key: "retry.baseDelayMs",
        label: t("Base delay (ms)"),
        type: "number",
        def: 2000,
        desc: t("Exponential backoff base (2s, 4s, 8s)"),
      },
      { key: "retry.provider.timeoutMs", label: t("Provider timeout (ms)"), type: "number" },
      {
        key: "retry.provider.maxRetries",
        label: t("Provider max retries"),
        type: "number",
        def: 0,
      },
      {
        key: "retry.provider.maxRetryDelayMs",
        label: t("Provider max retry delay (ms)"),
        type: "number",
        def: 60000,
      },
    ],
  },
  {
    title: t("Message Delivery"),
    fields: [
      {
        key: "steeringMode",
        label: t("Steering mode"),
        type: "enum",
        options: ["all", "one-at-a-time"],
        def: "one-at-a-time",
      },
      {
        key: "followUpMode",
        label: t("Follow-up mode"),
        type: "enum",
        options: ["all", "one-at-a-time"],
        def: "one-at-a-time",
      },
      {
        key: "transport",
        label: t("Transport"),
        type: "enum",
        options: ["sse", "websocket", "websocket-cached", "auto"],
        def: "auto",
      },
      { key: "httpIdleTimeoutMs", label: t("HTTP idle timeout (ms)"), type: "number", def: 300000 },
      {
        key: "websocketConnectTimeoutMs",
        label: t("WebSocket connect timeout (ms)"),
        type: "number",
        def: 15000,
      },
    ],
  },
  {
    title: t("Terminal & Images"),
    fields: [
      { key: "terminal.showImages", label: t("Show images in terminal"), type: "bool", def: true },
      { key: "terminal.imageWidthCells", label: t("Image width (cells)"), type: "number", def: 60 },
      {
        key: "terminal.clearOnShrink",
        label: t("Clear on shrink"),
        type: "bool",
        desc: t("Clear empty rows when content shrinks"),
      },
      {
        key: "images.autoResize",
        label: t("Auto-resize images"),
        type: "bool",
        def: true,
        desc: t("Resize images to 2000x2000 max"),
      },
      {
        key: "images.blockImages",
        label: t("Block images"),
        type: "bool",
        desc: t("Block all images from being sent to the LLM"),
      },
    ],
  },
  {
    title: t("Shell"),
    fields: [
      {
        key: "shellPath",
        label: t("Shell path"),
        type: "string",
        desc: t("Custom shell path (e.g. for Cygwin on Windows)"),
      },
      {
        key: "shellCommandPrefix",
        label: t("Command prefix"),
        type: "string",
        desc: t('Prefix for every bash command (e.g. "shopt -s expand_aliases")'),
      },
      {
        key: "npmCommand",
        label: t("npm command"),
        type: "string[]",
        desc: t("Command argv for npm operations (one entry per line)"),
      },
    ],
  },
  {
    title: t("Sessions"),
    fields: [
      {
        key: "sessionDir",
        label: t("Session directory"),
        type: "string",
        placeholder: ".pi/sessions",
      },
    ],
  },
  {
    title: t("Model Cycling"),
    fields: [
      {
        key: "enabledModels",
        label: t("Enabled models"),
        type: "string[]",
        desc: t("Model patterns for Ctrl+P cycling (one per line, globs like claude-* supported)"),
      },
    ],
  },
  {
    title: t("Markdown"),
    fields: [
      { key: "markdown.codeBlockIndent", label: t("Code block indent"), type: "string", def: "  " },
    ],
  },
  {
    title: t("Resources"),
    fields: [
      {
        key: "packages",
        label: t("Packages"),
        type: "json",
        desc: t("npm/git packages to load resources from (JSON array)"),
      },
      {
        key: "extensions",
        label: t("Extensions"),
        type: "string[]",
        desc: t("Local extension file paths or directories (one per line)"),
      },
      {
        key: "skills",
        label: t("Skills"),
        type: "string[]",
        desc: t("Local skill file paths or directories (one per line)"),
      },
      {
        key: "prompts",
        label: t("Prompts"),
        type: "string[]",
        desc: t("Local prompt template paths or directories (one per line)"),
      },
      {
        key: "themes",
        label: t("Themes"),
        type: "string[]",
        desc: t("Local theme file paths or directories (one per line)"),
      },
      {
        key: "enableSkillCommands",
        label: t("Enable skill commands"),
        type: "bool",
        def: true,
        desc: t("Register skills as /skill:name commands"),
      },
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
        return `<div class="cfg-field"><label class="field-label" for="${id}">${escHtml(f.label)}</label><select id="${id}" data-key="${escHtml(f.key)}">${(
          f.options ?? []
        )
          .map(
            (o) =>
              `<option value="${escHtml(o)}" ${o === init ? "selected" : ""}>${escHtml(o)}</option>`,
          )
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
    <input id="cfg-search" class="cfg-search" placeholder="${t("Search settings…")}" />
    <button class="btn-primary" data-action="save-settings"><span class="codicon codicon-save"></span> ${t("Save")}</button>
    <button class="btn-secondary" data-action="open-settings-file" title="${t("Open settings.json")}"><span class="codicon codicon-go-to-file"></span> settings.json</button>
  </div>
  <div id="cfg-error"></div>
  <div id="cfg-groups">
    ${GROUPS.map(
      (g, gi) => `
    <div class="cfg-group" data-gi="${gi}">
      <div class="cfg-group-header">
        <span class="codicon codicon-chevron-down"></span>
        <span>${escHtml(g.title)}</span>
        <button class="btn-icon cfg-reset" data-action="reset-group" data-gi="${gi}" title="${t("Reset to defaults")}"><span class="codicon codicon-discard"></span></button>
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
          return { patch: {}, error: t('Invalid JSON in "{0}"', f.label) };
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
          (el as HTMLTextAreaElement).value = Array.isArray(f.def)
            ? f.def.map(String).join("\n")
            : "";
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
