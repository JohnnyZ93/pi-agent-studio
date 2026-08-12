import { writeFileSync } from "node:fs";
import { existsSync, mkdtempSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bindServer, unlinkStaleSocket } from "./bind.ts";

// Sandboxed CI (nono) may deny TCP listen entirely, even on loopback. Probe
// once and skip the TCP suite in that case — the socket suite still runs.
const tcpListenAvailable = await new Promise<boolean>((resolve) => {
  const probe = createServer();
  probe.once("error", () => resolve(false));
  probe.listen(0, "127.0.0.1", () => {
    probe.close(() => resolve(true));
  });
});

const servers: Server[] = [];

function newServer(): Server {
  const server = createServer();
  servers.push(server);
  return server;
}

function listen(target: number | string): Promise<number> {
  const server = newServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(target, () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
}

// Binds a probe server on loopback, captures its port, closes it, and returns
// the now-free port. Untracked (not in `servers`) so afterEach never re-closes it.
async function freePort(): Promise<number> {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

describe.skipIf(!tcpListenAvailable)("bindServer TCP", () => {
  it("binds a random port when port is 0", async () => {
    const result = await bindServer(newServer(), { kind: "tcp", port: 0 });
    expect(result.port).toBeGreaterThan(0);
    expect(result.fallbackFrom).toBeUndefined();
  });

  it("binds a fixed free port", async () => {
    const port = await freePort();
    const result = await bindServer(newServer(), { kind: "tcp", port });
    expect(result.port).toBe(port);
    expect(result.fallbackFrom).toBeUndefined();
  });

  it("falls back to a random port when the fixed port is in use", async () => {
    const busyPort = await listen(0);
    const result = await bindServer(newServer(), { kind: "tcp", port: busyPort });
    expect(result.fallbackFrom).toBe(busyPort);
    expect(result.port).toBeGreaterThan(0);
    expect(result.port).not.toBe(busyPort);
  });
});

describe("bindServer socket", () => {
  it("creates the parent directory and binds with 0600 permissions", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-bridge-"));
    const socketPath = join(dir, "nested", "bridge.sock");
    const result = await bindServer(newServer(), {
      kind: "socket",
      path: socketPath,
      unique: true,
    });
    expect(result.socketPath).toBe(socketPath);
    expect(existsSync(socketPath)).toBe(true);
    expect(statSync(socketPath).mode & 0o777).toBe(0o600);
  });

  it("unlinks a stale file and rebinds for unique paths", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-bridge-"));
    const socketPath = join(dir, "stale.sock");
    writeFileSync(socketPath, "stale");
    const result = await bindServer(newServer(), {
      kind: "socket",
      path: socketPath,
      unique: true,
    });
    expect(result.socketPath).toBe(socketPath);
    expect(statSync(socketPath).isSocket()).toBe(true);
  });

  it("rejects a busy fixed path without unlinking the live server", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-bridge-"));
    const socketPath = join(dir, "live.sock");
    await listen(socketPath);
    await expect(
      bindServer(newServer(), { kind: "socket", path: socketPath }),
    ).rejects.toMatchObject({
      code: "EADDRINUSE",
    });
    expect(existsSync(socketPath)).toBe(true);
  });

  it("steals a stale (dead-window) path for unique sockets", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-bridge-"));
    const socketPath = join(dir, "taken.sock");
    await listen(socketPath);
    const result = await bindServer(newServer(), {
      kind: "socket",
      path: socketPath,
      unique: true,
    });
    expect(result.socketPath).toBe(socketPath);
  });

  it("skips mkdir/chmod/unlink-retry on win32", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-bridge-"));
    const missingDir = join(dir, "does-not-exist");
    await expect(
      bindServer(
        newServer(),
        { kind: "socket", path: join(missingDir, "x.sock"), unique: true },
        "win32",
      ),
      // The bind must fail because the parent dir was never created. Vanilla
      // Linux reports ENOENT; sandboxed environments may remap that to
      // EACCES/EPERM, so accept the whole path-resolution family.
    ).rejects.toMatchObject({ code: expect.stringMatching(/^(ENOENT|EACCES|EPERM)$/) });
    expect(existsSync(missingDir)).toBe(false);
  });
});

describe("unlinkStaleSocket", () => {
  async function bindSocketServer(socketPath: string): Promise<Server> {
    const server = newServer();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(socketPath, resolve);
    });
    return server;
  }

  it("unlinks a stale socket file when nothing is listening", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-bridge-"));
    const socketPath = join(dir, "stale-unlink.sock");
    // Stale artifact: path exists but nothing is listening (on real Linux this
    // is what a closed server leaves behind; this sandbox's tmpfs removes the
    // file on close, so fabricate it).
    writeFileSync(socketPath, "stale");
    await unlinkStaleSocket(socketPath);
    expect(existsSync(socketPath)).toBe(false);
  });

  it("leaves a live socket file alone", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-bridge-"));
    const socketPath = join(dir, "live-unlink.sock");
    await bindSocketServer(socketPath);
    await unlinkStaleSocket(socketPath);
    expect(existsSync(socketPath)).toBe(true);
  });

  it("does nothing on win32", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pi-bridge-"));
    const socketPath = join(dir, "win-unlink.sock");
    writeFileSync(socketPath, "stale");
    await unlinkStaleSocket(socketPath, "win32");
    expect(existsSync(socketPath)).toBe(true);
  });
});
