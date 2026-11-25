#!/usr/bin/env node
// Read-only status page for the grid bot, served on the bot machine (Tailscale address only).
// It reads the bot's state files, its journal and the chain. It never loads the wallet key,
// never signs or sends anything, and never touches anything outside this project's own files.
//
//   DASH_HOST=100.x.y.z DASH_PORT=8788 node src/bot-dash.js
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { promisify } from "node:util";
import { formatEther, formatUnits } from "viem";
import { LIMITS, STATE_DIR, STATE_FILE, TRADES_FILE, UNI, readMarket } from "./bot.js";
import { getNetwork } from "./networks.js";
import { clients } from "./wallet.js";

const HOST = process.env.DASH_HOST ?? "127.0.0.1";
const PORT = Number(process.env.DASH_PORT ?? 8788);
const ADDRESS = "0xFbE4C34cD9Bc33a83071C8380aB9Cf80dD97CdfF"; // the public game wallet
const root = new URL("..", import.meta.url).pathname;
const net = getNetwork("base");
const { pub } = clients(net);
const run = promisify(execFile);

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const readJson = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null);
const readLines = (f) => (existsSync(f) ? readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const eth = (x, d = 6) => (x == null ? "–" : `${x.toFixed(d)} ETH`);
const usd = (x) => (x == null ? "–" : `$${x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const signed = (x, d = 2) => `${x >= 0 ? "+" : ""}${x.toFixed(d)}`;
const cls = (x) => (x >= 0 ? "ahead" : "behind");
const when = (iso) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Oslo", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");
const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 6e4); return m < 90 ? `${m} min ago` : `${(m / 60).toFixed(1)} h ago`; };
const txLink = (h) => `<a href="${net.explorer}/tx/${esc(h)}">${esc(h.slice(0, 10))}…</a>`;

// Chain reads are cached for a minute, so reloading the page can't hammer the RPC.
let cache = { at: 0, m: null, err: null };
async function market() {
  if (Date.now() - cache.at < 60_000) return cache;
  try { cache = { at: Date.now(), m: await readMarket(pub, ADDRESS), err: null }; }
  catch (e) { cache = { at: Date.now(), m: cache.m, err: e.shortMessage ?? e.message }; }
  return cache;
}

async function journal() {
  try {
    const { stdout } = await run("journalctl", ["--user", "-u", "wallet-game-bot", "-n", "200", "--no-pager", "-o", "short-iso"], { timeout: 5000 });
    return stdout.split("\n").filter((l) => l.includes("wallet-game[")).slice(-30).reverse();
  } catch (e) { return [`(journal not readable: ${e.message})`]; }
}

function tradeRows(trades) {
  if (!trades.length) return `<p class="none">None yet.</p>`;
  const rows = trades.slice().reverse().map((t) => {
    const amount = t.side === "buy" ? `${t.usdcIn.toFixed(2)} USDC → ${(t.wethOut ?? t.wethOutMin).toFixed(6)} WETH${t.wethOut ? "" : " (min)"}`
      : `${t.wethIn.toFixed(6)} WETH → ${(t.usdcOut ?? t.usdcOutMin).toFixed(2)} USDC${t.usdcOut ? "" : " (min)"}`;
    const txs = (t.hashes ?? []).map(txLink).join(" ");
    return `<tr><td>${when(t.at)}</td><td>${esc(t.side)}</td><td>${usd(t.price)}</td><td>${signed(t.movePct)}%</td><td>${esc(amount)}</td><td>${txs || '<span class="muted">paper</span>'}</td></tr>`;
  }).join("");
  return `<div class="wide"><table><tr><th>When (Oslo)</th><th>Side</th><th>Price</th><th>Move</th><th>Amount</th><th>Tx</th></tr>${rows}</table></div>`;
}

async function page() {
  const [{ m, err, at }, log] = await Promise.all([market(), journal()]);
  const s = readJson(STATE_FILE);
  const game = readJson(join(root, "data/game.json"));
  const lvl = game?.levels.find((l) => l.id === game.currentLevel);
  const live = readLines(TRADES_FILE).filter((t) => t.mode === "live");
  const paper = readLines(join(STATE_DIR, "paper-trades.jsonl"));

  let overview = `<p class="banner">Chain not readable right now${err ? `: ${esc(err)}` : ""}.</p>`;
  let grid = "";
  if (m) {
    const e = Number(formatEther(m.eth)), w = Number(formatEther(m.weth)) + Number(formatEther(m.vaultWeth ?? 0n)), u = Number(formatUnits(m.usdc, 6)), v = Number(formatUnits(m.vault, 6));
    const score = e + w + (u + v) / m.price;
    const sh = lvl?.startHoldings;
    const bench = sh ? sh.eth + sh.weth + sh.usdc / m.price : null;
    const vsStart = lvl?.startValueEth ? (score / lvl.startValueEth - 1) * 100 : null;
    const left = lvl?.deadline ? new Date(lvl.deadline) - Date.now() : null;
    overview = `
<table>
<tr><th>Holdings in ETH</th><td><strong>${eth(score)}</strong> ≈ ${usd(score * m.price)}</td></tr>
${vsStart == null ? "" : `<tr><th>Against the start</th><td class="${cls(vsStart)}">${signed(score - lvl.startValueEth, 6)} ETH (${signed(vsStart)}%) · start ${eth(lvl.startValueEth)}</td></tr>`}
${lvl?.targetValueEth ? `<tr><th>Goal</th><td>${eth(lvl.targetValueEth)} (+${lvl.targetPct}%) · ${score >= lvl.targetValueEth ? '<span class="ahead">reached now</span>' : `${eth(lvl.targetValueEth - score)} to go`}</td></tr>` : ""}
${bench == null ? "" : `<tr><th>Benchmark: just hold the go-live 50/50</th><td>${eth(bench)} · grid is <span class="${cls(score - bench)}">${signed(score - bench, 6)} ETH (${signed((score / bench - 1) * 100)}%)</span></td></tr>`}
${left == null ? "" : `<tr><th>Time left</th><td>${left > 0 ? `${Math.floor(left / 864e5)} d ${Math.floor(left / 36e5) % 24} h · deadline ${when(lvl.deadline)} Oslo` : "deadline passed"}</td></tr>`}
<tr><th>Wallet</th><td>${e.toFixed(6)} ETH (gas) · ${w.toFixed(6)} WETH · ${u.toFixed(2)} USDC${v > 0 ? ` · ${v.toFixed(2)} USDC in Aave` : ""}</td></tr>
<tr><th>Price</th><td>${usd(m.price)} Chainlink (${Math.round(m.feedAgeSec / 60)} min old) · pool ${usd(m.poolPrice)} (${signed((m.poolPrice / m.price - 1) * 100)}%)</td></tr>
</table>`;
    if (s) {
      const buyAt = s.anchor * (1 - LIMITS.stepPct / 100), sellAt = s.anchor * (1 + LIMITS.stepPct / 100);
      grid = `
<table>
<tr><th>Last trade price (anchor)</th><td>${usd(s.anchor)}</td></tr>
<tr><th>Next buy</th><td>at or below ${usd(buyAt)} (${signed((buyAt / m.price - 1) * 100)}% from now) · $${LIMITS.sliceUsd} of USDC, ${Math.floor(u / LIMITS.sliceUsd)} buys left in the pot</td></tr>
<tr><th>Next sell</th><td>at or above ${usd(sellAt)} (${signed((sellAt / m.price - 1) * 100)}% from now) · $${LIMITS.sliceUsd} of WETH, ${Math.floor((w * m.price) / LIMITS.sliceUsd)} sells left in the pot</td></tr>
<tr><th>Trades today (UTC)</th><td>${s.day === new Date().toISOString().slice(0, 10) ? s.tradesToday : 0} of ${LIMITS.maxTradesPerDay}</td></tr>
<tr><th>Gas ETH</th><td>${e.toFixed(6)} · halts below ${LIMITS.fuelFloorEth}</td></tr>
</table>`;
    }
  }

  const status = !s ? `<p class="banner">No bot state found in ${esc(STATE_DIR)}.</p>`
    : s.halted ? `<p class="banner"><strong>Halted:</strong> ${esc(s.halted)}. Look at the run log, then clear with <code>node src/bot.js reset</code>.</p>`
    : `<p>Bot: <strong>${esc(s.mode)}</strong>, running since ${when(s.startedAt)} Oslo · errors in a row: ${s.errors} of ${LIMITS.haltAfterErrors}</p>`;

  const limits = Object.entries(LIMITS).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="60"><title>wallet-game bot</title><style>
:root { --bg: #f7f8fb; --fg: #161a26; --muted: #646b80; --line: #dcdfe8; --ahead: #1d7a45; --behind: #b3261e; --warn-bg: #fdecea; --accent: #2a4dff; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root { --bg: #11141d; --fg: #e6e8f0; --muted: #959bb0; --line: #2a2f3e; --ahead: #5fc98b; --behind: #ef8a80; --warn-bg: #3a1d1a; --accent: #8a9eff; color-scheme: dark; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
header { border-bottom: 1px solid var(--line); padding: 10px 16px; display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: baseline; }
main { padding: 8px 16px 40px; max-width: 1100px; }
a { color: var(--accent); }
h2 { font-size: 1.1em; margin-top: 1.6em; }
.wide { overflow-x: auto; }
table { border-collapse: collapse; margin: 6px 0 12px; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 4px 14px 4px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; }
pre { overflow-x: auto; font-size: 12.5px; line-height: 1.4; }
.muted, .none { color: var(--muted); } .ahead { color: var(--ahead); } .behind { color: var(--behind); }
.banner { background: var(--warn-bg); border: 1px solid var(--behind); padding: 8px 12px; margin: 12px 0; }
</style></head><body>
<header><strong>wallet-game bot</strong><span class="muted">Level 2 "Stack ETH" grid bot · read-only · chain read ${when(new Date(at).toISOString())} Oslo · page refreshes every minute</span></header>
<main>
${status}
<h2>Overview</h2>${overview}
<h2>Grid</h2>${grid || '<p class="none">No grid state.</p>'}
<h2>Live trades (${live.length})</h2>${tradeRows(live)}
<h2>Run log</h2><p class="muted">Last 30 runs, newest first. Runs every 15 minutes${log[0] ? `; latest line ${esc(log[0].slice(0, 25))}` : ""}.</p><pre>${log.map(esc).join("\n")}</pre>
<details><summary>Paper trades (${paper.length}), 14–15 Nov, before go-live</summary>${tradeRows(paper)}</details>
<h2>Settings</h2><p class="muted">Fixed for the whole level; changing them needs the game master. Pool: Uniswap v3 WETH/USDC ${UNI.fee / 1e4}% on Base, <a href="${net.explorer}/address/${UNI.pool}">${UNI.pool.slice(0, 10)}…</a>.</p><table>${limits}</table>
<p class="muted">Wallet <a href="${net.explorer}/address/${ADDRESS}">${ADDRESS}</a> · public dashboard <a href="https://frestina.github.io/wallet-game/dashboard/">frestina.github.io/wallet-game</a></p>
</main></body></html>`;
}

const headers = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

createServer(async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { allow: "GET, HEAD" }).end(); return; }
  if (new URL(req.url, "http://x").pathname !== "/") { res.writeHead(404, headers).end("<p>Not found. <a href=\"/\">Status</a></p>"); return; }
  try { const html = await page(); res.writeHead(200, headers).end(req.method === "HEAD" ? undefined : html); }
  catch (e) { console.error(e); res.writeHead(500, headers).end(`<p>Error: ${esc(e.message)}</p>`); }
}).listen(PORT, HOST, () => console.log(`wallet-game dash on http://${HOST}:${PORT}/`));
