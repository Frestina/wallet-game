#!/usr/bin/env node
// wallet-game grid bot (Level 2, "Stack ETH"). One short run per call; a systemd timer
// calls it every 15 minutes on the bot machine. It trades only WETH <-> USDC in the Uniswap v3
// 0.05% pool on Base, through SwapRouter02, and never touches the native ETH kept for gas.
//
//   node src/bot.js            one run (mode from WALLET_GAME_MODE: paper | live, default paper)
//   node src/bot.js status     print the bot state
//   node src/bot.js reset      clear a halt (after a human looked at why)
//   node src/bot.js split      go-live: balance WETH/USDC 50/50 (dry run; add --send to swap)
//
// Grid rule: when the Chainlink price is STEP below the last trade price, buy a slice of WETH
// with USDC; when it's STEP above, sell a slice of WETH for USDC. One trade per run.
// Hard limits below are fixed for the whole level; changing them needs the game master.
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { erc20Abi, formatEther, formatUnits, parseAbi, parseEther, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getNetwork } from "./networks.js";
import { clients } from "./wallet.js";

const LIMITS = {
  stepPct: 2,            // grid spacing
  sliceUsd: 10,          // size of one trade
  maxTradesPerDay: 6,
  maxSlippagePct: 0.5,   // min-out is set from the Chainlink price minus this
  maxFeedAgeSec: 3 * 3600,
  maxPoolDriftPct: 1,    // skip if pool price and Chainlink disagree by more than this
  fuelFloorEth: 0.0005,  // halt if the gas ETH falls below this
  haltAfterErrors: 3,
};

const UNI = {
  // Checked 2026-11-14 against Uniswap's Base deployments page and on-chain
  // (router.factory() and router.WETH9() match; factory.getPool(WETH, USDC, 500) = POOL).
  router: "0x2626664c2603336E57B271c5C0b26F421741e481",
  pool: "0xd0b53D9277642d899DF5C87A3966A349A798F224",
  fee: 500,
};
const CHAINLINK_ETH_USD = "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70";

const net = getNetwork("base");
const STATE_DIR = process.env.WALLET_GAME_STATE_DIR ?? join(homedir(), ".local", "state", "wallet-game");
const STATE_FILE = join(STATE_DIR, "grid.json");
const TRADES_FILE = join(STATE_DIR, "trades.jsonl");
const KEY_FILE = join(homedir(), ".config", "claude-game", "wallet.key");
const MODE = process.env.WALLET_GAME_MODE === "live" ? "live" : "paper";

const log = (msg) => console.log(`wallet-game[${MODE}]: ${msg}`);
const readState = () => (existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : null);
const writeState = (s) => { mkdirSync(STATE_DIR, { recursive: true }); writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + "\n"); };
const recordTrade = (t) => { mkdirSync(STATE_DIR, { recursive: true }); appendFileSync(TRADES_FILE, JSON.stringify(t) + "\n"); };

const routerAbi = parseAbi([
  "struct ExactInputSingleParams { address tokenIn; address tokenOut; uint24 fee; address recipient; uint256 amountIn; uint256 amountOutMinimum; uint160 sqrtPriceLimitX96; }",
  "function exactInputSingle(ExactInputSingleParams params) payable returns (uint256 amountOut)",
]);
const feedAbi = parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"]);
const poolAbi = parseAbi(["function slot0() view returns (uint160, int24, uint16, uint16, uint16, uint8, bool)"]);

async function readMarket(pub, address) {
  const erc20 = (token) => pub.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [address] });
  const [round, slot0, eth, weth, usdc, vault, vaultWeth] = await Promise.all([
    pub.readContract({ address: CHAINLINK_ETH_USD, abi: feedAbi, functionName: "latestRoundData" }),
    pub.readContract({ address: UNI.pool, abi: poolAbi, functionName: "slot0" }),
    pub.getBalance({ address }), erc20(net.weth), erc20(net.usdc), erc20(net.aUsdc), erc20(net.aWeth),
  ]);
  const price = Number(round[1]) / 1e8;
  const feedAgeSec = Math.floor(Date.now() / 1000) - Number(round[3]);
  const sq = Number(slot0[0]) / 2 ** 96;
  const poolPrice = sq * sq * 1e12; // token0 WETH (18 dec), token1 USDC (6 dec)
  return { price, feedAgeSec, poolPrice, eth, weth, usdc, vault, vaultWeth };
}

async function waitForAllowance(pub, token, owner, amount) {
  for (let i = 0; i < 20; i++) {
    const a = await pub.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, UNI.router] });
    if (a >= amount) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("allowance not visible after 20 s");
}

async function swapLive(pub, w, account, side, amountIn, minOut) {
  const [tokenIn, tokenOut] = side === "buy" ? [net.usdc, net.weth] : [net.weth, net.usdc];
  const hashes = [];
  // Exact approval for this trade only, never unlimited.
  const allowance = await pub.readContract({ address: tokenIn, abi: erc20Abi, functionName: "allowance", args: [account.address, UNI.router] });
  if (allowance < amountIn) {
    const h = await w.writeContract({ address: tokenIn, abi: erc20Abi, functionName: "approve", args: [UNI.router, amountIn] });
    await pub.waitForTransactionReceipt({ hash: h });
    hashes.push(h);
    await waitForAllowance(pub, tokenIn, account.address, amountIn);
  }
  const params = { tokenIn, tokenOut, fee: UNI.fee, recipient: account.address, amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n };
  const { request } = await pub.simulateContract({ account, address: UNI.router, abi: routerAbi, functionName: "exactInputSingle", args: [params] });
  const h = await w.writeContract(request);
  const receipt = await pub.waitForTransactionReceipt({ hash: h });
  hashes.push(h);
  if (receipt.status !== "success") throw new Error(`swap reverted: ${h}`);
  return hashes;
}

// One-time go-live step: swap WETH or USDC so both sides hold about the same value. Uses the
// same guards as a grid trade (fresh feed, pool close to Chainlink, min-out at Chainlink minus
// slippage). Without --send it only prints what it would do.
async function split(send) {
  const account = privateKeyToAccount(readFileSync(KEY_FILE, "utf8").trim());
  const { pub, wallet } = clients(net);
  const m = await readMarket(pub, account.address);
  if (m.feedAgeSec > LIMITS.maxFeedAgeSec) throw new Error(`Chainlink price is ${m.feedAgeSec}s old`);
  const drift = Math.abs(m.poolPrice / m.price - 1) * 100;
  if (drift > LIMITS.maxPoolDriftPct) throw new Error(`pool and Chainlink differ ${drift.toFixed(2)}%`);
  const usdc = Number(formatUnits(m.usdc, 6)), weth = Number(formatEther(m.weth));
  const diffUsd = (usdc - weth * m.price) / 2; // >0: buy WETH with this much USDC; <0: sell WETH
  const keep = 1 - LIMITS.maxSlippagePct / 100;
  console.log(`price $${m.price.toFixed(2)} (pool drift ${drift.toFixed(2)}%), ${weth.toFixed(6)} WETH + ${usdc.toFixed(2)} USDC`);
  if (Math.abs(diffUsd) < 1) return console.log("already balanced");
  if (diffUsd > 0) {
    const amountIn = parseUnits(diffUsd.toFixed(6), 6), minOut = parseEther(((diffUsd / m.price) * keep).toFixed(18));
    console.log(`buy: ${diffUsd.toFixed(2)} USDC -> at least ${formatEther(minOut)} WETH`);
    if (send) console.log("tx", (await swapLive(pub, wallet(account), account, "buy", amountIn, minOut)).join(" "));
  } else {
    const wethIn = -diffUsd / m.price;
    const amountIn = parseEther(wethIn.toFixed(18)), minOut = parseUnits((-diffUsd * keep).toFixed(6), 6);
    console.log(`sell: ${wethIn.toFixed(6)} WETH -> at least ${formatUnits(minOut, 6)} USDC`);
    if (send) console.log("tx", (await swapLive(pub, wallet(account), account, "sell", amountIn, minOut)).join(" "));
  }
  if (!send) console.log("dry run: add --send to swap");
}

// Lock the score in (game master's call, 2026-11-22): swap all USDC to WETH with the grid's guards,
// then halt the bot so it never trades again this level. An all-ETH wallet has a fixed ETH score.
async function lockin(send) {
  const account = privateKeyToAccount(readFileSync(KEY_FILE, "utf8").trim());
  const { pub, wallet } = clients(net);
  const m = await readMarket(pub, account.address);
  if (m.feedAgeSec > LIMITS.maxFeedAgeSec) throw new Error(`Chainlink price is ${m.feedAgeSec}s old`);
  const drift = Math.abs(m.poolPrice / m.price - 1) * 100;
  if (drift > LIMITS.maxPoolDriftPct) throw new Error(`pool and Chainlink differ ${drift.toFixed(2)}%`);
  const usdc = Number(formatUnits(m.usdc, 6));
  const minOut = parseEther(((usdc / m.price) * (1 - LIMITS.maxSlippagePct / 100)).toFixed(18));
  console.log(`price $${m.price.toFixed(2)} (pool drift ${drift.toFixed(2)}%), lock in: ${usdc.toFixed(6)} USDC -> at least ${formatEther(minOut)} WETH`);
  if (!send) return console.log("dry run: add --send to swap and halt");
  if (m.usdc > 0n) console.log("tx", (await swapLive(pub, wallet(account), account, "buy", m.usdc, minOut)).join(" "));
  const s = readState();
  if (s) { s.halted = "locked in: all USDC swapped to WETH, game master's call"; writeState(s); }
  console.log("halted");
}

async function run() {
  const account = privateKeyToAccount(readFileSync(KEY_FILE, "utf8").trim());
  const { pub, wallet } = clients(net);
  const m = await readMarket(pub, account.address);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  let s = readState();

  if (!s || s.mode !== MODE) {
    // First run in this mode. Paper starts from a 50/50 split of the whole wallet (vault USDC
    // included, since go-live withdraws it) minus gas fuel.
    const fuel = parseEther("0.002");
    const totalUsd = Number(formatUnits(m.usdc + m.vault, 6)) + Number(formatEther(m.weth + (m.eth > fuel ? m.eth - fuel : 0n))) * m.price;
    s = {
      mode: MODE, startedAt: now.toISOString(), anchor: m.price, day, tradesToday: 0, errors: 0, halted: null,
      paper: MODE === "paper" ? { weth: totalUsd / 2 / m.price, usdc: totalUsd / 2 } : undefined,
    };
    writeState(s);
    log(`started, anchor $${m.price.toFixed(2)}${MODE === "paper" ? `, paper pot ${s.paper.weth.toFixed(6)} WETH + ${s.paper.usdc.toFixed(2)} USDC` : ""}`);
    return;
  }
  if (s.day !== day) { s.day = day; s.tradesToday = 0; }

  const check = (ok, why) => { if (!ok) throw Object.assign(new Error(why), { skip: true }); };
  try {
    check(!s.halted, `halted: ${s.halted}. Clear with 'node src/bot.js reset' after checking why.`);
    check(m.feedAgeSec <= LIMITS.maxFeedAgeSec, `Chainlink price is ${m.feedAgeSec}s old`);
    const drift = Math.abs(m.poolPrice / m.price - 1) * 100;
    check(drift <= LIMITS.maxPoolDriftPct, `pool $${m.poolPrice.toFixed(2)} vs Chainlink $${m.price.toFixed(2)} differ ${drift.toFixed(2)}%`);
    if (MODE === "live" && Number(formatEther(m.eth)) < LIMITS.fuelFloorEth) {
      s.halted = `gas ETH below ${LIMITS.fuelFloorEth}`; throw Object.assign(new Error(s.halted), { skip: true });
    }

    const move = (m.price / s.anchor - 1) * 100;
    const side = move <= -LIMITS.stepPct ? "buy" : move >= LIMITS.stepPct ? "sell" : null;
    if (!side) { log(`hold: $${m.price.toFixed(2)}, ${move >= 0 ? "+" : ""}${move.toFixed(2)}% from anchor $${s.anchor.toFixed(2)}`); s.errors = 0; return; }
    check(s.tradesToday < LIMITS.maxTradesPerDay, `daily cap of ${LIMITS.maxTradesPerDay} trades reached`);

    const keep = 1 - LIMITS.maxSlippagePct / 100;
    const trade = { at: now.toISOString(), mode: MODE, side, price: m.price, anchor: s.anchor, movePct: Number(move.toFixed(2)) };
    if (side === "buy") {
      const usdcIn = LIMITS.sliceUsd;
      const wethOut = (usdcIn / m.price) * keep;
      if (MODE === "paper") {
        check(s.paper.usdc >= usdcIn, "no USDC left to buy with");
        const fill = (usdcIn / m.price) * (1 - UNI.fee / 1e6);
        s.paper.usdc -= usdcIn; s.paper.weth += fill;
        Object.assign(trade, { usdcIn, wethOut: fill });
      } else {
        const amountIn = parseUnits(usdcIn.toFixed(6), 6);
        check(m.usdc >= amountIn, "no USDC left to buy with");
        trade.hashes = await swapLive(pub, wallet(account), account, "buy", amountIn, parseEther(wethOut.toFixed(18)));
        Object.assign(trade, { usdcIn, wethOutMin: wethOut });
      }
    } else {
      const wethIn = LIMITS.sliceUsd / m.price;
      const usdcOut = LIMITS.sliceUsd * keep;
      if (MODE === "paper") {
        check(s.paper.weth >= wethIn, "no WETH left to sell");
        const fill = wethIn * m.price * (1 - UNI.fee / 1e6);
        s.paper.weth -= wethIn; s.paper.usdc += fill;
        Object.assign(trade, { wethIn, usdcOut: fill });
      } else {
        const amountIn = parseEther(wethIn.toFixed(18));
        check(m.weth >= amountIn, "no WETH left to sell");
        trade.hashes = await swapLive(pub, wallet(account), account, "sell", amountIn, parseUnits(usdcOut.toFixed(6), 6));
        Object.assign(trade, { wethIn, usdcOutMin: usdcOut });
      }
    }
    s.anchor = m.price; s.tradesToday += 1; s.errors = 0;
    recordTrade(trade);
    log(`${side} at $${m.price.toFixed(2)} (${move.toFixed(2)}% from anchor)${trade.hashes ? ` tx ${trade.hashes.at(-1)}` : ""}`);
  } catch (e) {
    if (e.skip) log(`skip: ${e.message}`);
    else {
      s.errors += 1;
      if (s.errors >= LIMITS.haltAfterErrors) s.halted = `${s.errors} errors in a row, last: ${e.shortMessage ?? e.message}`;
      log(`error ${s.errors}/${LIMITS.haltAfterErrors}: ${e.shortMessage ?? e.message}`);
      process.exitCode = 1;
    }
  } finally {
    writeState(s);
  }
}

// Shared with the read-only status page (src/bot-dash.js), which imports this file without
// running the bot: the commands below only run when bot.js itself is the program started.
export { LIMITS, UNI, STATE_DIR, STATE_FILE, TRADES_FILE, readMarket };

const isMain = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
const cmd = isMain ? process.argv[2] : "imported";
if (cmd === "imported") { /* used as a library */ }
else if (cmd === "status") console.log(JSON.stringify(readState(), null, 2));
else if (cmd === "reset") { const s = readState(); if (s) { s.halted = null; s.errors = 0; writeState(s); } console.log("cleared"); }
else if (cmd === "lockin") lockin(process.argv[3] === "--send").catch((e) => { console.error(`lockin failed: ${e.shortMessage ?? e.message}`); process.exit(1); });
else if (cmd === "split") split(process.argv[3] === "--send").catch((e) => { console.error(`split failed: ${e.shortMessage ?? e.message}`); process.exit(1); });
else run().catch((e) => { log(`fatal: ${e.shortMessage ?? e.message}`); process.exit(1); });
