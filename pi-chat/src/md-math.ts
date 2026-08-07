import type MarkdownIt from "markdown-it";
import type { RuleBlock } from "markdown-it/lib/parser_block.mjs";
import type { RuleInline } from "markdown-it/lib/parser_inline.mjs";

function isEscaped(src: string, pos: number): boolean {
  let backslashes = 0;
  for (let i = pos - 1; i >= 0 && src[i] === "\\"; i--) backslashes++;
  return backslashes % 2 === 1;
}

function findClosingDollar(src: string, from: number): number {
  for (let i = from; i < src.length; i++) {
    if (src[i] === "\\") {
      i++;
      continue;
    }
    if (src[i] === "$") {
      if (i > from && /\s/.test(src[i - 1])) continue;
      return i;
    }
  }
  return -1;
}

const mathInline: RuleInline = (state, silent) => {
  const start = state.pos;
  if (state.src[start] !== "$") return false;
  if (state.level >= ((state.md.options as any).maxNesting ?? 1000)) return false;
  if (isEscaped(state.src, start)) return false;
  if (start + 1 < state.src.length && /\s/.test(state.src[start + 1])) return false;
  const end = findClosingDollar(state.src, start + 1);
  if (end < 0) return false;
  const content = state.src.slice(start + 1, end);
  if (!content.trim()) return false;
  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.content = content;
    token.markup = "$";
  }
  state.pos = end + 1;
  return true;
};

const mathInlineParen: RuleInline = (state, silent) => {
  const start = state.pos;
  if (state.src.startsWith("\\(", start) === false) return false;
  const end = state.src.indexOf("\\)", start + 2);
  if (end < 0) return false;
  const content = state.src.slice(start + 2, end);
  if (!content.trim()) return false;
  if (!silent) {
    const token = state.push("math_inline", "math", 0);
    token.content = content;
    token.markup = "\\(";
  }
  state.pos = end + 2;
  return true;
};

const mathBlock: RuleBlock = (state, startLine, endLine, silent) => {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (state.src.startsWith("$$", start) === false) return false;
  if (silent) return true;

  let pos = state.src.indexOf("$$", start + 2);
  let content: string | null = null;
  let nextLine = startLine;
  if (pos >= 0 && pos <= max) {
    const c = state.src.slice(start + 2, pos);
    if (c.trim()) {
      content = c;
    }
  }
  if (content === null) {
    for (let line = startLine + 1; line < endLine; line++) {
      const b = state.bMarks[line] + state.tShift[line];
      const e = state.eMarks[line];
      pos = state.src.indexOf("$$", b);
      if (pos >= b && pos <= e) {
        content = state
          .getLines(startLine, line, state.blkIndent, false)
          .replace(/^\s*\$\$\s*\n?/, "")
          .replace(/\n$/, "");
        nextLine = line;
        break;
      }
    }
  }
  if (content === null) return false;
  const token = state.push("math_block", "math", 0);
  token.block = true;
  token.content = content;
  token.markup = "$$";
  state.line = nextLine + 1;
  return true;
};

const mathBlockBracket: RuleBlock = (state, startLine, endLine, silent) => {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  const src = state.src;
  if (src.startsWith("\\[", start) === false) return false;
  if (silent) return true;

  let content: string | null = null;
  let nextLine = -1;
  if (src.indexOf("\\]", start + 2) >= start + 2 && src.indexOf("\\]", start + 2) <= max) {
    content = src.slice(start + 2, src.indexOf("\\]", start + 2));
    nextLine = startLine;
  } else {
    const open = "\\[";
    for (let line = startLine + 1; line < endLine; line++) {
      const b = state.bMarks[line] + state.tShift[line];
      const e = state.eMarks[line];
      const closePos = src.indexOf("\\]", b);
      if (closePos >= b && closePos <= e) {
        content = state
          .getLines(startLine, line, state.blkIndent, false)
          .replace(new RegExp(`^\\s*${open.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}?`), "")
          .replace(/\n$/, "");
        nextLine = line;
        break;
      }
    }
  }
  if (content === null || !content.trim()) return false;
  const token = state.push("math_block", "math", 0);
  token.block = true;
  token.content = content;
  token.markup = "\\[";
  state.line = nextLine + 1;
  return true;
};

export function mathPlugin(md: MarkdownIt): void {
  md.inline.ruler.before("text", "math_inline", mathInline);
  md.inline.ruler.before("escape", "math_inline_paren", mathInlineParen);
  md.block.ruler.before("paragraph", "math_block", mathBlock);
  md.block.ruler.before("paragraph", "math_block_bracket", mathBlockBracket);

  md.renderer.rules.math_inline = (tokens, idx) => {
    const tex = encodeURIComponent(tokens[idx].content.trim());
    return `<span class="pi-math pi-math-inline" data-tex="${tex}"></span>`;
  };
  md.renderer.rules.math_block = (tokens, idx) => {
    const tex = encodeURIComponent(tokens[idx].content.trim());
    return `\n<div class="pi-math pi-math-block" data-tex="${tex}"></div>\n`;
  };
}
