import { el, messagesEl, messagesInner } from "./globals";
import { t } from "./i18n";

const railEl = document.getElementById("timeline-rail");
let popoverEl: HTMLElement | null = null;
let observer: IntersectionObserver | null = null;
let rebuildRAF: number | null = null;
let showTimer: number | null = null;
let hideTimer: number | null = null;

interface TimelineEntry {
  type: "prompt" | "sep";
  row?: HTMLElement;
  text?: string;
}

let entries: TimelineEntry[] = [];
let dots: HTMLElement[] = [];
let rows: HTMLElement[] = [];

function extractUserText(row: HTMLElement): string {
  const bubble = row.querySelector(".user-bubble") as HTMLElement | null;
  if (!bubble) return "";
  const txt = bubble.textContent || "";
  const trimmed = txt.trim();
  return trimmed.length > 80 ? trimmed.slice(0, 80) + "\u2026" : trimmed;
}

function gatherEntries(): TimelineEntry[] {
  const list: TimelineEntry[] = [];
  const kids = messagesInner.children;
  for (let i = 0; i < kids.length; i++) {
    const child = kids[i] as HTMLElement;
    if (!child || !child.classList) continue;
    if (child.classList.contains("msg") && child.classList.contains("user")) {
      list.push({
        type: "prompt",
        row: child,
        text: extractUserText(child),
      });
    } else if (child.classList.contains("msg") && child.classList.contains("compaction")) {
      list.push({ type: "sep" });
    }
  }
  return list;
}

function renderTimeline(list: TimelineEntry[]) {
  entries = list;
  dots = [];
  rows = [];
  if (!railEl) return;
  railEl.innerHTML = "";
  if (popoverEl) popoverEl.innerHTML = "";
  if (!list.length) {
    railEl.style.display = "none";
    if (popoverEl) popoverEl.classList.remove("is-open");
    return;
  }
  railEl.style.display = "flex";
  if (popoverEl) popoverEl.style.display = "";
  let promptIdx = 0;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.type === "sep") {
      railEl.appendChild(el("span", "timeline-sep"));
      continue;
    }
    const idx = promptIdx++;
    const dot = el("button", "timeline-dot");
    dot.type = "button";
    dot.setAttribute("aria-label", t("Prompt timeline"));
    dot.addEventListener("click", function () {
      if (e.row) e.row.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    dot.addEventListener("mouseenter", function () {
      setHover(idx);
    });
    dot.addEventListener("mouseleave", clearHover);
    railEl.appendChild(dot);
    dots.push(dot);

    if (popoverEl) {
      const row = el("div", "timeline-pop-row");
      const dd = el("span", "timeline-pop-dot");
      row.appendChild(dd);
      const main = el("div", "timeline-pop-main");
      const txt = el("div", "timeline-pop-text");
      txt.textContent = e.text || t("(empty prompt)");
      main.appendChild(txt);
      row.appendChild(main);
      row.addEventListener("click", function () {
        if (e.row) e.row.scrollIntoView({ block: "start", behavior: "smooth" });
      });
      row.addEventListener("mouseenter", function () {
        setHover(idx);
      });
      row.addEventListener("mouseleave", clearHover);
      popoverEl.appendChild(row);
      rows.push(row);
    }
  }
}

function setHover(idx: number) {
  for (let i = 0; i < dots.length; i++) dots[i].classList.toggle("is-hover", i === idx);
  for (let j = 0; j < rows.length; j++) rows[j].classList.toggle("is-hover", j === idx);
}

function clearHover() {
  for (let i = 0; i < dots.length; i++) dots[i].classList.remove("is-hover");
  for (let j = 0; j < rows.length; j++) rows[j].classList.remove("is-hover");
}

function showPopover() {
  if (!popoverEl || !entries.length) return;
  if (hideTimer != null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (showTimer != null) return;
  showTimer = window.setTimeout(function () {
    showTimer = null;
    if (popoverEl && entries.length) {
      popoverEl.style.display = "";
      popoverEl.classList.add("is-open");
    }
  }, 150);
}

function hidePopover() {
  if (showTimer != null) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  if (!popoverEl) return;
  hideTimer = window.setTimeout(function () {
    hideTimer = null;
    if (popoverEl) popoverEl.classList.remove("is-open");
  }, 120);
}

function observeCurrent() {
  if (!observer) {
    observer = new IntersectionObserver(
      function (records) {
        let best: HTMLElement | null = null;
        let bestTop = -Infinity;
        for (let i = 0; i < records.length; i++) {
          const rec = records[i];
          if (!rec.isIntersecting) continue;
          const target = rec.target as HTMLElement;
          const top = target.getBoundingClientRect().top;
          if (top <= 80 && top > bestTop) {
            bestTop = top;
            best = target;
          }
        }
        if (best) setCurrentRow(best);
        else updateCurrentByScroll();
      },
      { root: null, rootMargin: "0px 0px -60% 0px", threshold: 0 },
    );
  }
  const userRows = messagesInner.querySelectorAll(".msg.user");
  observer.disconnect();
  for (let i = 0; i < userRows.length; i++) observer.observe(userRows[i]);
}

function rowToIndex(row: HTMLElement): number {
  const userRows = Array.prototype.slice.call(messagesInner.querySelectorAll(".msg.user"));
  return userRows.indexOf(row);
}

function setCurrentRow(row: HTMLElement) {
  const idx = rowToIndex(row);
  for (let i = 0; i < dots.length; i++) dots[i].classList.toggle("is-current", i === idx);
  for (let j = 0; j < rows.length; j++) rows[j].classList.toggle("is-current", j === idx);
  if (idx >= 0 && idx < dots.length) {
    dots[idx].scrollIntoView({ block: "nearest" });
  }
}

function updateCurrentByScroll() {
  const userRows = messagesInner.querySelectorAll(".msg.user");
  let best: HTMLElement | null = null;
  let bestTop = -Infinity;
  for (let i = 0; i < userRows.length; i++) {
    const top = (userRows[i] as HTMLElement).getBoundingClientRect().top;
    if (top <= 80 && top > bestTop) {
      bestTop = top;
      best = userRows[i] as HTMLElement;
    }
  }
  if (best) setCurrentRow(best);
  else if (userRows.length) setCurrentRow(userRows[0] as HTMLElement);
}

export function scheduleTimelineRebuild(): void {
  if (rebuildRAF != null) return;
  rebuildRAF = requestAnimationFrame(function () {
    rebuildRAF = null;
    rebuildTimeline();
  });
}

export function rebuildTimeline(): void {
  renderTimeline(gatherEntries());
  observeCurrent();
  updateCurrentByScroll();
}

export function clearTimeline(): void {
  entries = [];
  dots = [];
  rows = [];
  if (!railEl) return;
  railEl.innerHTML = "";
  railEl.style.display = "none";
  if (popoverEl) {
    popoverEl.innerHTML = "";
    popoverEl.classList.remove("is-open");
  }
  if (observer) observer.disconnect();
}

export function initTimeline(): void {
  if (!railEl) return;
  const host = railEl.parentElement;
  if (host) {
    popoverEl = el("div", "timeline-popover");
    popoverEl.setAttribute("role", "tooltip");
    host.appendChild(popoverEl);
    popoverEl.addEventListener("mouseenter", function () {
      if (hideTimer != null) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    });
    popoverEl.addEventListener("mouseleave", hidePopover);
  }
  railEl.addEventListener("mouseenter", showPopover);
  railEl.addEventListener("mouseleave", hidePopover);
  messagesEl.addEventListener("scroll", function () {
    requestAnimationFrame(updateCurrentByScroll);
  });
}
