// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { JSDOM, VirtualConsole } from "jsdom";
import { getChatHtml } from "../src/chat/chat-html.ts";

function setup() {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e: any) => console.error("jsdomError:", e.message));
  const html = getChatHtml(undefined, undefined, 13);
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window: any) {
      window.acquireVsCodeApi = () => ({
        postMessage: () => {},
        getState: () => null,
        setState: () => {},
      });
      window.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 0);
      window.cancelAnimationFrame = (id: any) => clearTimeout(id);
    },
  });
  return dom.window as any;
}

function dispatch(w: any, data: any) {
  w.dispatchEvent(new w.MessageEvent("message", { data }));
}

describe("work-block title line counts", () => {
  it("aggregates edit +/- and write + line counts", async () => {
    const w = setup();
    const diff = "--- a/f\n+++ b/f\n@@ -1,3 +1,4 @@\n line1\n-old2\n+new2\n+new3\n line3";
    const messages = [
      { role: "user", timestamp: 1000, content: "do it" },
      {
        role: "assistant",
        timestamp: 2000,
        content: [
          { type: "thinking", thinking: "planning" },
          { type: "toolCall", name: "edit", id: "tc1", arguments: { path: "f" } },
        ],
      },
      { role: "toolResult", toolCallId: "tc1", content: "ok", details: { diff } },
      { role: "assistant", timestamp: 3000, content: [{ type: "text", text: "done" }] },
      { role: "user", timestamp: 4000, content: "write a file" },
      {
        role: "assistant",
        timestamp: 5000,
        content: [
          {
            type: "toolCall",
            name: "write",
            id: "tc2",
            arguments: { path: "g", content: "a\nb\nc\nd" },
          },
        ],
      },
      { role: "toolResult", toolCallId: "tc2", content: "ok" },
      { role: "assistant", timestamp: 6000, content: [{ type: "text", text: "written" }] },
    ];
    dispatch(w, { type: "messages", messages });
    await new Promise((r) => setTimeout(r, 80));
    const heads = w.document.querySelectorAll(".work-head");
    expect(heads.length).toBe(2);
    const h0 = heads[0].innerHTML;
    const h1 = heads[1].innerHTML;
    expect(h0).toContain("+2");
    expect(h0).toContain("deletedResourceForeground");
    expect(h0).toContain("-1");
    expect(h1).toContain("+4");
    expect(h1).not.toContain("deletedResourceForeground");
  });
});
