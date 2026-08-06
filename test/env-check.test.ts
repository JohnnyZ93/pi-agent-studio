import { describe, expect, it } from "vitest";
import { isNodeVersionSupported } from "../src/settings/node-version.ts";

describe("isNodeVersionSupported", () => {
  it("accepts the minimum supported version", () => {
    expect(isNodeVersionSupported("22.19.0")).toBe(true);
  });

  it("accepts newer versions", () => {
    expect(isNodeVersionSupported("22.19.1")).toBe(true);
    expect(isNodeVersionSupported("22.20.0")).toBe(true);
    expect(isNodeVersionSupported("23.0.0")).toBe(true);
    expect(isNodeVersionSupported("24.1.2")).toBe(true);
    expect(isNodeVersionSupported("v22.19.0")).toBe(true);
  });

  it("rejects older versions", () => {
    expect(isNodeVersionSupported("22.18.9")).toBe(false);
    expect(isNodeVersionSupported("22.18.0")).toBe(false);
    expect(isNodeVersionSupported("20.11.1")).toBe(false);
    expect(isNodeVersionSupported("18.20.0")).toBe(false);
  });

  it("rejects unparseable input", () => {
    expect(isNodeVersionSupported("")).toBe(false);
    expect(isNodeVersionSupported("abc")).toBe(false);
    expect(isNodeVersionSupported("22")).toBe(false);
  });
});
