import { describe, it, expect, vi } from "vitest";
import pino from "pino";
import { TS3Client } from "./client.js";

/**
 * Integration "smoke test" for the admin-command gate's group resolution.
 *
 * It drives the REAL TS3Client.getClientServerGroups → library getClientInfo
 * path against a stubbed underlying client, so it exercises the actual
 * `clientinfo clid=<id>` query string and the real `client_servergroups`
 * parsing — the pieces that were previously only verified by reading the code.
 *
 * What this CANNOT cover (inherently server-side, needs a live TS server):
 * whether a real server returns groups for a client in a DIFFERENT channel.
 * The stub models the server-wide answer (groups returned regardless of
 * channel); the failure modes below confirm we fail closed when it doesn't.
 */
function makeClient(): TS3Client {
  return new TS3Client(
    { host: "localhost", port: 9987, queryPort: 10011, nickname: "TestBot" },
    pino({ level: "silent" }),
  );
}

/** Inject a fake low-level client carrying a canned clientinfo response. */
function withFakeClient(
  ts: TS3Client,
  respond: (cmd: string) => Record<string, string>[] | Promise<Record<string, string>[]>,
): string[] {
  const calls: string[] = [];
  const fake = {
    execCommandWithResponse: vi.fn(async (cmd: string) => {
      calls.push(cmd);
      return respond(cmd);
    }),
  };
  (ts as unknown as { client: unknown }).client = fake;
  return calls;
}

describe("TS3Client.getClientServerGroups — live query + parse smoke test", () => {
  it("issues `clientinfo clid=<id>` and parses comma-separated client_servergroups", async () => {
    const ts = makeClient();
    const calls = withFakeClient(ts, () => [
      { client_nickname: "Alice", cid: "99", client_servergroups: "6,8" },
    ]);

    const groups = await ts.getClientServerGroups(5);

    expect(groups).toEqual(["6", "8"]);
    // Exact query the bot sends to resolve a sender's groups, by client id.
    expect(calls[0]).toBe("clientinfo clid=5");
  });

  it("parses a single-group response", async () => {
    const ts = makeClient();
    withFakeClient(ts, () => [{ client_servergroups: "6" }]);
    expect(await ts.getClientServerGroups(5)).toEqual(["6"]);
  });

  it("returns [] when the client carries no server groups (empty field)", async () => {
    const ts = makeClient();
    withFakeClient(ts, () => [{ client_nickname: "Bob", client_servergroups: "" }]);
    expect(await ts.getClientServerGroups(7)).toEqual([]);
  });

  it("returns [] when the server-groups field is absent", async () => {
    const ts = makeClient();
    withFakeClient(ts, () => [{ client_nickname: "Carol" }]);
    expect(await ts.getClientServerGroups(7)).toEqual([]);
  });

  it("fails closed (returns []) when the query throws / client id is unknown", async () => {
    const ts = makeClient();
    withFakeClient(ts, () => {
      throw new Error("invalid clientID");
    });
    expect(await ts.getClientServerGroups(999)).toEqual([]);
  });

  it("returns [] when not connected (no underlying client)", async () => {
    const ts = makeClient();
    expect(await ts.getClientServerGroups(5)).toEqual([]);
  });
});
