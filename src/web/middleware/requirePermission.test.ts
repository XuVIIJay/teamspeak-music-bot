import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { requirePermission, requireBotAccess } from "./requirePermission.js";

function appWith(user: any) {
  const app = express();
  app.use((req, _res, next) => { (req as any).user = user; next(); });
  app.post("/cap", requirePermission("quality"), (_req, res) => res.json({ ok: true }));
  app.post("/bot/:botId", requireBotAccess("botId"), (_req, res) => res.json({ ok: true }));
  return app;
}

const member = (caps: string[], bots: "all" | string[]) => ({
  id: "u1", username: "a", role: "member",
  capabilities: new Set(caps), bots: bots === "all" ? "all" : new Set(bots),
});
const admin = { id: "a", username: "admin", role: "admin", capabilities: new Set(), bots: "all" };

describe("requirePermission", () => {
  it("401 when unauthenticated", async () => {
    const app = express();
    app.post("/cap", requirePermission("quality"), (_r, res) => res.json({ ok: true }));
    expect((await request(app).post("/cap")).status).toBe(401);
  });
  it("403 when member lacks the capability", async () => {
    expect((await request(appWith(member([], "all"))).post("/cap")).status).toBe(403);
  });
  it("200 when member has the capability", async () => {
    expect((await request(appWith(member(["quality"], "all"))).post("/cap")).status).toBe(200);
  });
  it("200 for admin regardless of capabilities", async () => {
    expect((await request(appWith(admin)).post("/cap")).status).toBe(200);
  });
});

describe("requireBotAccess", () => {
  it("200 when bots = all", async () => {
    expect((await request(appWith(member([], "all"))).post("/bot/b1")).status).toBe(200);
  });
  it("200 when botId in allow-list", async () => {
    expect((await request(appWith(member([], ["b1"]))).post("/bot/b1")).status).toBe(200);
  });
  it("403 when botId not in allow-list", async () => {
    expect((await request(appWith(member([], ["b2"]))).post("/bot/b1")).status).toBe(403);
  });
  it("200 for admin", async () => {
    expect((await request(appWith(admin)).post("/bot/b1")).status).toBe(200);
  });
  it("401 when unauthenticated", async () => {
    const app = express();
    app.post("/bot/:botId", requireBotAccess("botId"), (_r, res) => res.json({ ok: true }));
    expect((await request(app).post("/bot/b1")).status).toBe(401);
  });
  it("403 when the route param is absent", async () => {
    const app = express();
    app.use((req, _res, next) => { (req as any).user = member([], ["b1"]); next(); });
    app.post("/bot/:botId", requireBotAccess("nope"), (_r, res) => res.json({ ok: true }));
    expect((await request(app).post("/bot/b1")).status).toBe(403);
  });
});
