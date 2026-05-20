#!/usr/bin/env node

/**
 * Download native binaries (ffmpeg + @discordjs/opus) from npmmirror CDN.
 * Called by setup.bat/ setup.sh after npm install --ignore-scripts.
 *
 * Usage: node scripts/download-binaries.mjs [cdn_base_url]
 */

import {
  existsSync, mkdirSync, writeFileSync, statSync,
  readFileSync, rmSync, cpSync, readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import { get } from "node:https";
import { Readable } from "node:stream";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CDN = process.argv[2] || "https://cdn.npmmirror.com/binaries";
const PLATFORM = process.platform;
const ARCH = process.arch;
const NODE_ABI = process.versions.modules;
const ABI_FILE = join(ROOT, ".node-abi");

/** Known glibc versions that have prebuilt binaries on GitHub (newest first) */
const GLIBC_VERSIONS = ["2.35", "2.31"];

// ---- libc detection ----

/**
 * Detect the system libc string for Linux.
 * Returns e.g. "glibc-2.35", "musl-1.2.3", or "unknown-unknown" (Win/macOS/fallback).
 */
function detectLibc() {
  if (PLATFORM !== "linux") return "unknown-unknown";
  try {
    const out = execSync(
      "getconf GNU_LIBC_VERSION 2>/dev/null || ldd --version 2>&1 | head -1",
      { encoding: "utf-8" },
    ).trim();
    const glibc = out.match(/glibc\s+(\d+\.\d+)/i);
    if (glibc) return `glibc-${glibc[1]}`;
    const ldd = execSync("ldd --version 2>&1 || true", { encoding: "utf-8" }).trim();
    if (ldd.includes("musl")) {
      const m = ldd.match(/Version (\d+\.\d+)/);
      if (m) return `musl-${m[1]}`;
    }
  } catch {}
  return "unknown-unknown";
}

/** Cache libc string — it won't change during a single run */
const LIBC = detectLibc();

/** Return the prebuild sub-directory name for a given libc string */
function prebuildDir(libc) {
  return `node-v${NODE_ABI}-napi-v3-${PLATFORM}-${ARCH}-${libc}`;
}

/** Ordered list of libc strings to try when downloading (exact → fallbacks) */
function fallbackLibcs() {
  if (LIBC.startsWith("glibc-")) {
    const fallbacks = GLIBC_VERSIONS.map((v) => `glibc-${v}`);
    return [...new Set([LIBC, ...fallbacks])];
  }
  return [LIBC];
}

// ---- ABI change guard ----

function checkAbi() {
  try {
    const stored = readFileSync(ABI_FILE, "utf-8").trim();
    if (stored !== String(NODE_ABI)) {
      log(`Node ABI changed (was ${stored}, now ${NODE_ABI}), re-downloading binaries...`);
      for (const d of [
        join(ROOT, "node_modules", "@discordjs", "opus", "prebuild"),
        join(ROOT, "node_modules", "better-sqlite3", "build"),
      ]) {
        if (existsSync(d)) rmSync(d, { recursive: true, force: true });
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function saveAbi() {
  writeFileSync(ABI_FILE, String(NODE_ABI), "utf-8");
}

// ---- helpers ----

function download(url) {
  return new Promise((resolve, reject) => {
    const req = get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function log(msg) {
  console.log(`  [binary] ${msg}`);
}

const GH_PROXIES = [
  "https://ghproxy.com/",
  "https://gh-proxy.com/",
  "",
];

function isValidSize(filePath, minBytes) {
  try { return statSync(filePath).size >= minBytes; } catch { return false; }
}

// ---- ffmpeg ----

async function downloadFfmpeg() {
  const ffDir = join(ROOT, "node_modules", "ffmpeg-static");
  const ffName = PLATFORM === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const ffDest = join(ffDir, ffName);

  if (!existsSync(ffDir)) { log("ffmpeg-static not installed, skipping"); return false; }
  if (existsSync(ffDest)) {
    if (isValidSize(ffDest, 50 * 1024 * 1024)) {
      log("ffmpeg already exists, skipping");
      return true;
    }
    log("ffmpeg exists but seems corrupted (too small), re-downloading...");
  }

  const url = `${CDN}/ffmpeg-static/b6.1.1/ffmpeg-${PLATFORM}-${ARCH}.gz`;
  log("Downloading ffmpeg...");
  const buf = await download(url);
  await pipeline(Readable.from(buf), createGunzip(), createWriteStream(ffDest));
  try { execSync(`chmod +x "${ffDest}"`); } catch {}
  const size = (statSync(ffDest).size / 1024 / 1024).toFixed(1);
  log(`ffmpeg OK (${size} MB)`);
  return true;
}

// ---- @discordjs/opus ----

async function downloadOpus() {
  const opusDir = join(ROOT, "node_modules", "@discordjs", "opus");
  const exactDir = prebuildDir(LIBC);
  const exactDest = join(opusDir, "prebuild", exactDir, "opus.node");

  if (!existsSync(opusDir)) { log("@discordjs/opus not installed, skipping"); return false; }
  if (existsSync(exactDest)) {
    if (isValidSize(exactDest, 100 * 1024)) {
      log("@discordjs/opus already exists, skipping");
      return true;
    }
    log("@discordjs/opus exists but seems corrupted (too small), re-downloading...");
  }

  // Try each libc version (exact first, then fallbacks like glibc-2.35), then each URL source.
  // CDN is tried first per libc version (fast in China), then GitHub proxies.
  for (const libc of fallbackLibcs()) {
    const pDir = prebuildDir(libc);
    const pkgFile = `opus-v0.10.0-${pDir}.tar.gz`;
    const ghReleaseUrl = `https://github.com/discordjs/opus/releases/download/v0.10.0/${pkgFile}`;

    const urls = [
      { label: `CDN (${libc})`, url: `${CDN}/@discordjs/opus/v0.10.0/${pkgFile}` },
      ...GH_PROXIES.map((p) => ({
        label: `GitHub ${p ? "proxy" : "direct"} (${libc})`,
        url: p + ghReleaseUrl,
      })),
    ];

    for (const { label, url } of urls) {
      log(`Downloading @discordjs/opus from ${label}...`);
      try {
        const buf = await download(url);
        const extractDir = join(opusDir, "prebuild");
        mkdirSync(extractDir, { recursive: true });
        const require = createRequire(import.meta.url);
        const tar = require("tar");
        const tmpFile = join(tmpdir(), `discordjs-opus-${Date.now()}.tar.gz`);
        writeFileSync(tmpFile, buf);
        await tar.extract({ cwd: extractDir, file: tmpFile });

        // If the downloaded glibc version != the system glibc, copy binary to
        // the system path so node-pre-gyp can find it at runtime.
        if (libc !== LIBC) {
          const src = join(extractDir, pDir);
          const dst = join(extractDir, exactDir);
          if (existsSync(src) && !existsSync(dst)) {
            mkdirSync(dst, { recursive: true });
            for (const f of readdirSync(src)) {
              cpSync(join(src, f), join(dst, f));
            }
            log(`Copied ${libc} binary to ${LIBC} path`);
          }
        }
        log("@discordjs/opus OK");
        return true;
      } catch (err) {
        log(`${label} failed: ${err.message}`);
      }
    }
  }

  // ---- source build fallback ----
  log("All download sources failed, trying to build from source...");
  try {
    execSync("npm rebuild @discordjs/opus", { cwd: ROOT, stdio: "inherit" });
    // After rebuild, check the exact libc path (node-pre-gyp writes to
    // the system's actual libc directory)
    if (existsSync(exactDest) && isValidSize(exactDest, 100 * 1024)) {
      log("@discordjs/opus OK (built from source)");
      return true;
    }
    log("Source build completed but .node file not found");
    return false;
  } catch (buildErr) {
    const hint = PLATFORM === "win32"
      ? "Install Visual Studio Build Tools: https://visualstudio.microsoft.com/visual-cpp-build-tools/"
      : "Install build tools: sudo apt install build-essential (Debian/Ubuntu)";
    log(`Source build failed: ${buildErr.message}`);
    log(`  ${hint}`);
    return false;
  }
}

// ---- better-sqlite3 ----

async function downloadBetterSqlite3() {
  const pkgDir = join(ROOT, "node_modules", "better-sqlite3");
  const dest = join(pkgDir, "build", "Release", "better_sqlite3.node");

  if (!existsSync(pkgDir)) { log("better-sqlite3 not installed, skipping"); return false; }
  if (existsSync(dest)) {
    if (isValidSize(dest, 500 * 1024)) {
      log("better-sqlite3 already exists, skipping");
      return true;
    }
    log("better-sqlite3 exists but seems corrupted (too small), re-downloading...");
  }

  const version = "12.8.0";
  const url = `${CDN}/better-sqlite3/v${version}/better-sqlite3-v${version}-node-v${NODE_ABI}-${PLATFORM}-${ARCH}.tar.gz`;
  log("Downloading better-sqlite3...");
  const buf = await download(url);
  const require = createRequire(import.meta.url);
  const tar = require("tar");
  const tmpFile = join(tmpdir(), `better-sqlite3-${Date.now()}.tar.gz`);
  writeFileSync(tmpFile, buf);
  mkdirSync(dirname(dest), { recursive: true });
  await tar.extract({ cwd: pkgDir, file: tmpFile });
  if (existsSync(dest)) {
    log(`better-sqlite3 OK (${(statSync(dest).size / 1024).toFixed(0)} KB)`);
    return true;
  }
  log("better-sqlite3 extracted but .node file not found at expected path");
  return false;
}

// ---- main ----

checkAbi();

let hasError = false;
try {
  const results = await Promise.all([downloadFfmpeg(), downloadOpus(), downloadBetterSqlite3()]);
  const [ffOk, opusOk, sqlOk] = results;
  const allOk = ffOk && opusOk && sqlOk;
  if (allOk) {
    console.log("  [OK] All native binaries installed");
    saveAbi();
  } else {
    console.log("  [WARN] Some native binaries failed (see above)");
    hasError = !opusOk || !sqlOk;
  }
} catch (e) {
  console.error(`  [binary] FATAL: ${e.message}`);
  hasError = true;
}

if (hasError) {
  console.error("");
  console.error("  Some native binaries could not be installed.");
  console.error("  The bot may not work correctly without them.");
  process.exit(1);
}
