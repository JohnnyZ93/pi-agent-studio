import { describe, expect, it } from "vitest";
import { resolveEndpoint } from "./endpoint.ts";

describe("resolveEndpoint", () => {
  it("defaults to a random TCP port for empty or missing values", () => {
    expect(resolveEndpoint(undefined, 42)).toEqual({ kind: "tcp", port: 0 });
    expect(resolveEndpoint("", 42)).toEqual({ kind: "tcp", port: 0 });
    expect(resolveEndpoint("   ", 42)).toEqual({ kind: "tcp", port: 0 });
  });

  it("accepts a valid fixed port", () => {
    expect(resolveEndpoint("8123", 42)).toEqual({ kind: "tcp", port: 8123 });
    expect(resolveEndpoint("65535", 42)).toEqual({ kind: "tcp", port: 65535 });
  });

  it("treats invalid numeric values as random with the invalid flag", () => {
    expect(resolveEndpoint("0", 42)).toEqual({ kind: "tcp", port: 0, invalid: true });
    expect(resolveEndpoint("70000", 42)).toEqual({ kind: "tcp", port: 0, invalid: true });
    expect(resolveEndpoint("99999999999", 42)).toEqual({ kind: "tcp", port: 0, invalid: true });
  });

  it("treats non-numeric values as socket paths", () => {
    expect(resolveEndpoint("/tmp/pi.sock", 42)).toEqual({ kind: "socket", path: "/tmp/pi.sock" });
  });

  it("substitutes {windowId} and marks the path unique", () => {
    expect(resolveEndpoint("/run/user/1000/pi-vscode/bridge-{windowId}.sock", 7)).toEqual({
      kind: "socket",
      path: "/run/user/1000/pi-vscode/bridge-7.sock",
      unique: true,
    });
  });

  it("accepts a Windows named-pipe path with substitution", () => {
    expect(resolveEndpoint("\\\\.\\pipe\\pi-vscode-{windowId}", 7)).toEqual({
      kind: "socket",
      path: "\\\\.\\pipe\\pi-vscode-7",
      unique: true,
    });
  });
});
