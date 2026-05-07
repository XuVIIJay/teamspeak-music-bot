// Empirically verifies the PowerShell-download workaround for jdymusic CDN
// blocks Node.js HTTP. Runs A/B against the same fresh /jdymusic/ URL:
//   A) ffmpeg direct with browser UA (the previous fix in this branch)
//   B) PowerShell WebClient -> temp file -> ffmpeg from file (the new fix)
// Reports bytes received + exit code + stderr-tail for each.

import { spawn } from "node:child_process";
import { mkdtempSync, statSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFfmpegArgs } from "../dist/audio/player.js";

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/test_jdymusic_powershell.mjs <jdymusic_url>");
  process.exit(2);
}
if (!url.includes("/jdymusic/")) {
  console.error("warning: this script targets /jdymusic/ URLs specifically");
}

const FFMPEG = "ffmpeg";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const TIMEOUT_MS = 20_000;

function runFfmpeg(label, args, stdinSource) {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG, args, { stdio: [stdinSource ?? "ignore", "pipe", "pipe"] });
    let bytes = 0;
    let stderrTail = "";
    let killed = false;
    proc.stdout.on("data", (chunk) => { bytes += chunk.length; });
    proc.stderr.on("data", (chunk) => { stderrTail = (stderrTail + chunk.toString()).slice(-1500); });
    const timer = setTimeout(() => { killed = true; proc.kill("SIGTERM"); }, TIMEOUT_MS);
    proc.on("exit", (code, signal) => {
      clearTimeout(timer);
      resolve({ label, bytes, code, signal, killed, stderrTail });
    });
  });
}

function downloadViaPowerShell(targetUrl, outFile) {
  return new Promise((resolve) => {
    const psScript = [
      "$ErrorActionPreference = 'Stop'",
      "$ProgressPreference = 'SilentlyContinue'",
      "$wc = New-Object System.Net.WebClient",
      "$wc.Headers.Add('User-Agent', $env:DL_UA)",
      "$wc.Headers.Add('Referer', $env:DL_REFERER)",
      "$wc.DownloadFile($env:DL_URL, $env:DL_OUT)",
    ].join("; ");
    const ps = spawn(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript],
      {
        env: {
          ...process.env,
          DL_URL: targetUrl,
          DL_OUT: outFile,
          DL_UA: BROWSER_UA,
          DL_REFERER: "https://music.163.com/",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stderr = "";
    ps.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    ps.on("exit", (code) => resolve({ code, stderr }));
  });
}

console.log(`URL: ${url}\n`);

console.log("[A] ffmpeg direct (browser UA via -headers)");
const a = await runFfmpeg("A", buildFfmpegArgs(url, 0));
console.log(`    code=${a.code} bytes=${a.bytes} killed=${a.killed}`);
console.log(`    stderr-tail: ${a.stderrTail.split("\n").slice(-3).join(" | ")}\n`);

console.log("[B] PowerShell WebClient -> temp file -> ffmpeg -i tempfile");
const tempDir = mkdtempSync(join(tmpdir(), "tsbot-jdymusic-test-"));
const tempFile = join(tempDir, "song.audio");
const psStart = Date.now();
const dl = await downloadViaPowerShell(url, tempFile);
const psMs = Date.now() - psStart;
if (dl.code !== 0) {
  console.log(`    PowerShell download FAILED: code=${dl.code}`);
  console.log(`    stderr: ${dl.stderr.slice(-500)}`);
  rmSync(tempDir, { recursive: true, force: true });
  process.exit(1);
}
const dlSize = statSync(tempFile).size;
console.log(`    PowerShell downloaded ${dlSize} bytes in ${psMs}ms`);

const b = await runFfmpeg("B", buildFfmpegArgs(tempFile, 0));
console.log(`    ffmpeg-from-file: code=${b.code} bytes=${b.bytes} killed=${b.killed}`);
console.log(`    stderr-tail: ${b.stderrTail.split("\n").slice(-3).join(" | ")}\n`);

rmSync(tempDir, { recursive: true, force: true });

const aBlocked = a.bytes === 0 && !a.killed;
const bWorked = b.bytes > 100_000;
console.log(
  `Verdict: direct ${aBlocked ? "BLOCKED" : "OK"} ; ` +
  `powershell-then-ffmpeg ${bWorked ? "WORKED" : "FAILED"}`,
);
