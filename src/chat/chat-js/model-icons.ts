import { DEFAULT_MODEL_ICON, MODEL_ICONS } from "../model-icons-data.ts";

export function getModelIconsJs(): string {
  const iconsJson = JSON.stringify(MODEL_ICONS);
  const defaultJson = JSON.stringify(DEFAULT_MODEL_ICON);
  return `// ---- model brand icons (data from src/chat/model-icons-data.ts) ----
var MODEL_ICONS = ${iconsJson};
var DEFAULT_MODEL_ICON = ${defaultJson};
function getModelIcon(modelName) {
  var name = String(modelName == null ? '' : modelName);
  var slash = name.indexOf('/');
  if (slash >= 0) name = name.slice(slash + 1);
  var lower = name.toLowerCase();
  for (var i = 0; i < MODEL_ICONS.length; i++) {
    var entry = MODEL_ICONS[i];
    var p = entry.prefixes;
    for (var k = 0; k < p.length; k++) {
      if (lower.indexOf(p[k]) === 0) return entry;
    }
  }
  return DEFAULT_MODEL_ICON;
}
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return '&#' + c.charCodeAt(0) + ';';
  });
}
function modelIconHtml(icon, cls) {
  icon = icon || DEFAULT_MODEL_ICON;
  var svg = '<svg viewBox="0 0 24 24" fill="#fff" fill-rule="evenodd" aria-hidden="true">';
  for (var i = 0; i < icon.paths.length; i++) {
    svg += '<path d="' + icon.paths[i] + '"></path>';
  }
  svg += '</svg>';
  return '<span class="model-icon-avatar' + (cls ? ' ' + cls : '') + '" style="background:' + icon.color + '" title="' + escHtml(icon.title) + '">' + svg + '</span>';
}`;
}
