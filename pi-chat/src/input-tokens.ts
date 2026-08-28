import { shortenWorkspacePath } from "./globals";

export type Segment =
  | { type: "text"; text: string }
  | { type: "cmd"; value: string }
  | { type: "file"; value: string; label: string };

export function basenameOf(path: string): string {
  if (!path) return "";
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1];
}

function isWhitespace(ch: string): boolean {
  return /\s/.test(ch);
}

function pushFileSegment(segs: Segment[], raw: string): void {
  const value = shortenWorkspacePath(raw);
  segs.push({ type: "file", value, label: basenameOf(value) });
}

function parseSegments(text: string, live: boolean, caret: number): Segment[] {
  const segs: Segment[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf) {
      segs.push({ type: "text", text: buf });
      buf = "";
    }
  };
  const editing = (j: number) => live && caret > i && caret <= j;
  while (i < text.length) {
    const ch = text.charAt(i);
    const isTokenStart = i === 0 || isWhitespace(text.charAt(i - 1));
    const isCmdStart = i === 0;
    if (ch === "/" && isCmdStart) {
      let j = i + 1;
      while (j < text.length && !isWhitespace(text.charAt(j))) j++;
      if (!editing(j)) {
        flush();
        segs.push({ type: "cmd", value: text.slice(i, j) });
        i = j;
        continue;
      }
    } else if (ch === "@" && isTokenStart) {
      let j = i + 1;
      while (j < text.length && !isWhitespace(text.charAt(j))) j++;
      if (j > i + 1 && !editing(j)) {
        flush();
        pushFileSegment(segs, text.slice(i + 1, j));
        i = j;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return segs;
}

export function segmentsFromText(text: string): Segment[] {
  return parseSegments(text, false, 0);
}

export function segmentsFromLiveText(text: string, caret: number): Segment[] {
  return parseSegments(text, true, caret);
}

export function serializeSegments(segments: Segment[]): string {
  let out = "";
  for (const seg of segments) {
    if (seg.type === "text") out += seg.text;
    else if (seg.type === "cmd") out += seg.value;
    else out += "@" + seg.value;
  }
  return out;
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE)
    return "";
  if (node.nodeType === Node.ELEMENT_NODE) {
    const eln = node as HTMLElement;
    if (eln.tagName === "BR") return "\n";
    if (eln.classList && eln.classList.contains("token-file"))
      return "@" + (eln.getAttribute("data-path") || "");
    if (eln.classList && eln.classList.contains("token-cmd"))
      return eln.getAttribute("data-value") || eln.textContent || "";
  }
  let out = "";
  for (const child of Array.from(node.childNodes)) out += serializeNode(child);
  return out;
}

function placeSelection(node: Node, offset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  try {
    range.setStart(node, offset);
    range.collapse(true);
  } catch {
    range.selectNodeContents(node);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

export function getCaretOffset(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return 0;
  const pre = document.createRange();
  pre.selectNodeContents(root);
  try {
    pre.setEnd(range.startContainer, range.startOffset);
  } catch {
    return 0;
  }
  return serializeNode(pre.cloneContents()).length;
}

export function setCaretOffset(root: HTMLElement, offset: number): void {
  let remaining = Math.max(0, offset);
  let container: Node = root;
  let pos = root.childNodes.length;

  const find = (node: Node, parent: Node, idx: number): boolean => {
    if (remaining <= 0 && node.nodeType !== Node.TEXT_NODE) {
      container = parent;
      pos = idx;
      return true;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length || 0;
      if (remaining <= len) {
        container = node;
        pos = remaining;
        return true;
      }
      remaining -= len;
      return false;
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE)
      return false;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const eln = node as HTMLElement;
      if (eln.tagName === "BR") {
        remaining -= 1;
        return false;
      }
      if (eln.classList && eln.classList.contains("token-file")) {
        const len = 1 + (eln.getAttribute("data-path")?.length || 0);
        if (remaining <= 0) {
          container = parent;
          pos = idx;
          return true;
        }
        if (remaining < len) {
          container = parent;
          pos = idx + 1;
          return true;
        }
        remaining -= len;
        return false;
      }
      if (eln.classList && eln.classList.contains("token-cmd")) {
        const len = (eln.getAttribute("data-value") || eln.textContent || "").length;
        if (remaining <= 0) {
          container = parent;
          pos = idx;
          return true;
        }
        if (remaining < len) {
          container = parent;
          pos = idx + 1;
          return true;
        }
        remaining -= len;
        return false;
      }
    }
    const children = Array.from(node.childNodes);
    for (let i = 0; i < children.length; i++) {
      if (find(children[i], node, i)) return true;
    }
    return false;
  };

  find(root, root, 0);
  placeSelection(container, pos);
}

export function renderSegments(root: HTMLElement, segments: Segment[], caretOffset?: number): void {
  root.innerHTML = "";
  for (const seg of segments) {
    if (seg.type === "text") {
      const parts = seg.text.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) root.appendChild(document.createElement("br"));
        if (parts[i]) root.appendChild(document.createTextNode(parts[i]));
      }
    } else if (seg.type === "cmd") {
      const span = document.createElement("span");
      span.className = "token token-cmd";
      span.contentEditable = "false";
      span.setAttribute("data-value", seg.value);
      span.textContent = seg.value;
      root.appendChild(span);
    } else {
      const span = document.createElement("span");
      span.className = "token token-file";
      span.contentEditable = "false";
      span.setAttribute("data-path", seg.value);
      span.setAttribute("data-value", seg.value);
      span.textContent = seg.label || basenameOf(seg.value);
      root.appendChild(span);
    }
  }
  if (caretOffset != null) setCaretOffset(root, caretOffset);
}
