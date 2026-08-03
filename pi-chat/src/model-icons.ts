import { DEFAULT_MODEL_ICON, MODEL_ICONS, type ModelIconEntry } from "./model-icons-data";

export function getModelIcon(modelName: string | null | undefined): ModelIconEntry {
  let name = String(modelName == null ? "" : modelName);
  const slash = name.indexOf("/");
  if (slash >= 0) name = name.slice(slash + 1);
  const lower = name.toLowerCase();
  for (let i = 0; i < MODEL_ICONS.length; i++) {
    const entry = MODEL_ICONS[i];
    const p = entry.prefixes;
    for (let k = 0; k < p.length; k++) {
      if (lower.indexOf(p[k]) === 0) return entry;
    }
  }
  return DEFAULT_MODEL_ICON;
}

export function escHtml(s: string | null | undefined): string {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
}

export function modelIconHtml(icon: ModelIconEntry | null | undefined, cls?: string): string {
  icon = icon || DEFAULT_MODEL_ICON;
  let svg = '<svg viewBox="0 0 24 24" fill="#fff" fill-rule="evenodd" aria-hidden="true">';
  for (let i = 0; i < icon.paths.length; i++) {
    svg += '<path d="' + icon.paths[i] + '"></path>';
  }
  svg += "</svg>";
  return (
    '<span class="model-icon-avatar' +
    (cls ? " " + cls : "") +
    '" style="background:' +
    icon.color +
    '">' +
    svg +
    "</span>"
  );
}
