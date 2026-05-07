import { describe, it, expect, beforeEach, vi } from "vitest";
import { BotProfileManager } from "./profile.js";
import type { TS3Client } from "../ts-protocol/client.js";

function makeMockTs(): TS3Client & {
  uploadCalls: Buffer[];
  clearCalls: number;
} {
  const calls: Buffer[] = [];
  let clears = 0;
  const ts: any = {
    uploadCalls: calls,
    get clearCalls() { return clears; },
    getHost: () => "127.0.0.1",
    getHttpQuery: () => null,
    fileTransferInitUpload: vi.fn().mockResolvedValue({}),
    uploadFileData: vi.fn().mockImplementation(async (_h: any, _i: any, stream: any) => {
      const chunks: Buffer[] = [];
      for await (const c of stream) chunks.push(c as Buffer);
      calls.push(Buffer.concat(chunks));
    }),
    fileTransferDeleteFile: vi.fn().mockResolvedValue(undefined),
    sendCommandNoWait: vi.fn().mockImplementation(async (cmd: string) => {
      if (/client_flag_avatar=$/.test(cmd)) clears++;
    }),
  };
  return ts;
}

const noopLogger: any = { child: () => noopLogger, info: () => {}, debug: () => {}, warn: () => {}, error: () => {} };

const cfgOn = { avatarEnabled: true, descriptionEnabled: false, nicknameEnabled: false, awayStatusEnabled: false, channelDescEnabled: false, nowPlayingMsgEnabled: false };
const cfgOff = { ...cfgOn, avatarEnabled: false };

describe("BotProfileManager custom avatar precedence", () => {
  let ts: ReturnType<typeof makeMockTs>;
  beforeEach(() => { ts = makeMockTs(); });

  it("on stop with custom avatar set + sync on, uploads custom (does not clear)", async () => {
    const pm = new BotProfileManager(ts as any, noopLogger, cfgOn, "Bot");
    const custom = Buffer.from([1, 2, 3, 4]);
    pm.setCustomAvatar(custom);
    await pm.onSongChange(null);
    expect(ts.uploadCalls.at(-1)?.equals(custom)).toBe(true);
    expect(ts.clearCalls).toBe(0);
  });

  it("on stop with no custom avatar, falls back to clear", async () => {
    const pm = new BotProfileManager(ts as any, noopLogger, cfgOn, "Bot");
    await pm.onSongChange(null);
    expect(ts.clearCalls).toBe(1);
    expect(ts.uploadCalls.length).toBe(0);
  });

  it("on connect with sync off + custom avatar set, applies custom immediately", async () => {
    const pm = new BotProfileManager(ts as any, noopLogger, cfgOff, "Bot");
    pm.setCustomAvatar(Buffer.from([9, 9]));
    await pm.onConnect();
    // onConnect fires the upload but may be async fire-and-forget; flush microtasks:
    await new Promise((r) => setImmediate(r));
    expect(ts.uploadCalls.length).toBe(1);
    expect(ts.uploadCalls[0].equals(Buffer.from([9, 9]))).toBe(true);
  });

  it("on connect with sync off + no custom avatar, does not touch avatar", async () => {
    const pm = new BotProfileManager(ts as any, noopLogger, cfgOff, "Bot");
    await pm.onConnect();
    await new Promise((r) => setImmediate(r));
    expect(ts.uploadCalls.length).toBe(0);
    expect(ts.clearCalls).toBe(0);
  });

  it("setCustomAvatar(null) makes subsequent onSongChange(null) clear again", async () => {
    const pm = new BotProfileManager(ts as any, noopLogger, cfgOn, "Bot");
    pm.setCustomAvatar(Buffer.from([1]));
    pm.setCustomAvatar(null);
    await pm.onSongChange(null);
    expect(ts.clearCalls).toBe(1);
  });
});
