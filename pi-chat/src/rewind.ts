import {
  vscode,
  state,
  el,
  showTooltip,
  hideTooltip,
  showToast,
  overlayEl,
  shortenWorkspacePath,
} from "./globals";
import { basenameOf } from "./input-tokens";
import { t } from "./i18n";

const ICON_CHEVRON = '<span class="codicon codicon-chevron-right"></span>';
const ICON_ACCEPT = '<span class="codicon codicon-check"></span>';
const ICON_REVERT_FILE = '<span class="codicon codicon-discard"></span>';

const rewindWidgetEl = document.getElementById("rewind-widget")!;
let rewindCollapsed = true;

export function tipBtn(btn: HTMLButtonElement, text: string): HTMLButtonElement {
  btn.addEventListener("mouseenter", function () {
    showTooltip(btn, text);
  });
  btn.addEventListener("mouseleave", hideTooltip);
  return btn;
}

export function appendCounts(parent: HTMLElement, added?: number, removed?: number): void {
  const hasAdd = added != null && added > 0;
  const hasRem = removed != null && removed > 0;
  if (hasAdd) {
    const a = el("span", "rewind-add");
    a.textContent = "+" + added;
    parent.appendChild(a);
  }
  if (hasRem) {
    const r = el("span", "rewind-removed");
    r.textContent = "-" + removed;
    parent.appendChild(r);
  }
  if (!hasAdd && !hasRem) parent.textContent = "-";
}

export function applyRewindWidget(lines: string[]) {
  if (!lines || !lines.length) {
    rewindWidgetEl.style.display = "none";
    rewindWidgetEl.innerHTML = "";
    return;
  }
  let data: any = {};
  try {
    data = JSON.parse(lines[0] || "{}");
  } catch {
    /* ignore */
  }
  const files = data.files || [];
  const totals = data.totals || { added: 0, removed: 0 };
  if (!files.length) {
    rewindWidgetEl.style.display = "none";
    rewindWidgetEl.innerHTML = "";
    return;
  }
  rewindWidgetEl.innerHTML = "";
  rewindWidgetEl.classList.toggle("is-collapsed", rewindCollapsed);
  rewindWidgetEl.style.display = "block";

  const card = el("div", "widget-card rewind-card");
  const head = el("div", "rewind-head");

  const chev = el("span", "rewind-chevron");
  chev.innerHTML = ICON_CHEVRON;
  chev.addEventListener("click", function () {
    rewindCollapsed = !rewindCollapsed;
    applyRewindWidget(lines);
  });
  head.appendChild(chev);

  const title = el("span", "rewind-title");
  title.textContent = t("Modified files ({0})", files.length);
  head.appendChild(title);

  const totalsEl = el("span", "rewind-totals");
  appendCounts(totalsEl, totals.added, totals.removed);
  head.appendChild(totalsEl);

  const headActions = el("span", "rewind-head-actions");
  const acceptAll = el("button", "rewind-btn rewind-accept") as HTMLButtonElement;
  acceptAll.type = "button";
  acceptAll.innerHTML = ICON_ACCEPT + "<span>" + t("Accept all") + "</span>";
  acceptAll.addEventListener("click", function () {
    if (state.isStreaming) {
      showToast(t("Stop the agent before changing files."), "error");
      return;
    }
    vscode.postMessage({ type: "rewindAccept" });
  });
  headActions.appendChild(acceptAll);

  const revertAll = el("button", "rewind-btn rewind-revert") as HTMLButtonElement;
  revertAll.type = "button";
  revertAll.innerHTML = ICON_REVERT_FILE + "<span>" + t("Revert all") + "</span>";
  revertAll.addEventListener("click", function () {
    if (state.isStreaming) {
      showToast(t("Stop the agent before reverting."), "error");
      return;
    }
    showRewindConfirm(
      t("Revert all {0} file{1}?", files.length, files.length === 1 ? "" : "s"),
      t(
        "Files will be restored to their last accepted state. Conversation history is not affected.",
      ),
      function () {
        vscode.postMessage({ type: "rewindRevert" });
      },
      t("Confirm revert"),
    );
  });
  headActions.appendChild(revertAll);
  head.appendChild(headActions);
  card.appendChild(head);

  if (!rewindCollapsed) {
    const body = el("div", "rewind-body");
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const row = el("div", "rewind-row");
      const fileEl = el("span", "rewind-file");
      const displayPath = shortenWorkspacePath(f.absPath);
      fileEl.textContent = f.basename || basenameOf(displayPath);
      fileEl.addEventListener("mouseenter", function () {
        showTooltip(fileEl, displayPath);
      });
      fileEl.addEventListener("mouseleave", hideTooltip);
      fileEl.addEventListener(
        "click",
        (function (f: any) {
          return function () {
            vscode.postMessage({
              type: "rewindDiff",
              absPath: f.absPath,
              baselineHash: f.baselineHash,
              sessionId: data.sessionId,
              basename: f.basename,
            });
          };
        })(f),
      );
      row.appendChild(fileEl);

      const counts = el("span", "rewind-counts");
      appendCounts(counts, f.added, f.removed);
      row.appendChild(counts);

      const rowActions = el("span", "rewind-row-actions");
      const accBtn = el("button", "rewind-btn rewind-accept") as HTMLButtonElement;
      accBtn.type = "button";
      accBtn.innerHTML = ICON_ACCEPT;
      tipBtn(accBtn, t("Accept"));
      accBtn.addEventListener(
        "click",
        (function (id: any) {
          return function () {
            if (state.isStreaming) {
              showToast(t("Stop the agent before changing files."), "error");
              return;
            }
            vscode.postMessage({ type: "rewindAcceptFile", id: id });
          };
        })(f.id),
      );
      rowActions.appendChild(accBtn);

      const revBtn = el("button", "rewind-btn rewind-revert") as HTMLButtonElement;
      revBtn.type = "button";
      revBtn.innerHTML = ICON_REVERT_FILE;
      tipBtn(revBtn, t("Revert"));
      revBtn.addEventListener(
        "click",
        (function (id: any) {
          return function () {
            if (state.isStreaming) {
              showToast(t("Stop the agent before reverting."), "error");
              return;
            }
            vscode.postMessage({ type: "rewindRevertFile", id: id });
          };
        })(f.id),
      );
      rowActions.appendChild(revBtn);
      row.appendChild(rowActions);

      body.appendChild(row);
    }
    card.appendChild(body);
  }

  rewindWidgetEl.appendChild(card);
}

export function renderRewindDialog(box: HTMLElement, request: any) {
  box.classList.add("rewind-dialog");
  let data: any = {};
  try {
    data = JSON.parse(request.prefill || "{}");
  } catch {
    /* ignore */
  }
  const label = data.label || "";
  let affected = Number(data.affected);
  if (!isFinite(affected)) affected = 0;

  const h = box.querySelector("h3");
  if (h) h.textContent = t("Revert");
  if (label) {
    const p = document.createElement("p");
    p.textContent = label;
    box.appendChild(p);
  }
  const p2 = document.createElement("p");
  p2.textContent = t("{0} file{1} affected", affected, affected === 1 ? "" : "s");
  box.appendChild(p2);

  const actions = el("div", "dialog-actions");
  const msgOnly = el("button", "btn btn-secondary") as HTMLButtonElement;
  msgOnly.textContent = t("Revert message only");
  msgOnly.addEventListener("click", function () {
    respond(request.id, { value: "message-only" });
  });
  actions.appendChild(msgOnly);

  const msgAndCode = el("button", "btn btn-primary") as HTMLButtonElement;
  msgAndCode.textContent = t("Revert message + code");
  msgAndCode.addEventListener("click", function () {
    respond(request.id, { value: "message+code" });
  });
  actions.appendChild(msgAndCode);

  const cancel = el("button", "btn btn-secondary") as HTMLButtonElement;
  cancel.textContent = t("Cancel");
  cancel.addEventListener("click", function () {
    respond(request.id, { cancelled: true });
  });
  actions.appendChild(cancel);

  box.appendChild(actions);
}

function respond(id: string, payload: any) {
  vscode.postMessage(Object.assign({ type: "dialogResponse", id: id }, payload));
  overlayEl.style.display = "none";
  overlayEl.innerHTML = "";
}

export function showRewindConfirm(
  title: string,
  description: string,
  onConfirm: () => void,
  confirmText: string,
) {
  overlayEl.innerHTML = "";
  const box = el("div", "dialog rewind-dialog");
  const h = document.createElement("h3");
  h.textContent = title || t("Confirm");
  box.appendChild(h);
  const p = document.createElement("p");
  p.textContent = description || "";
  box.appendChild(p);
  const actions = el("div", "dialog-actions");
  const cancel = el("button", "btn btn-secondary") as HTMLButtonElement;
  cancel.textContent = t("Cancel");
  cancel.addEventListener("click", function () {
    overlayEl.style.display = "none";
    overlayEl.innerHTML = "";
  });
  const confirm = el("button", "btn btn-primary") as HTMLButtonElement;
  confirm.textContent = confirmText || t("Confirm");
  confirm.addEventListener("click", function () {
    (confirm as HTMLButtonElement).disabled = true;
    overlayEl.style.display = "none";
    overlayEl.innerHTML = "";
    if (onConfirm) onConfirm();
  });
  actions.appendChild(cancel);
  actions.appendChild(confirm);
  box.appendChild(actions);
  overlayEl.appendChild(box);
  overlayEl.style.display = "flex";
}
