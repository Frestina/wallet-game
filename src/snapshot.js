#!/usr/bin/env node
// Builds dashboard/state.json from data/game.json plus live balances from the chain.
import { readFileSync, writeFileSync } from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { homedir } from "node:os";
import { join } from "node:path";
import { getNetwork } from "./networks.js";
import { balances } from "./wallet.js";

const root = new URL("..", import.meta.url).pathname;
const game = JSON.parse(readFileSync(join(root, "data/game.json"), "utf8"));
const net = getNetwork(game.network);
const address = privateKeyToAccount(readFileSync(join(homedir(), ".config/claude-game/wallet.key"), "utf8").trim()).address;

const [bal, ethUsd] = await Promise.all([
  balances(net, address),
  fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot").then((r) => r.json()).then((j) => Number(j.data.amount)).catch(() => null),
]);
const valueUsd = ethUsd == null ? null : Number(bal.usdc) + Number(bal.vaultUsdc) + (Number(bal.eth) + Number(bal.weth)) * ethUsd;

const state = {
  updatedAt: new Date().toISOString(),
  wallet: {
    address,
    network: game.network,
    testnet: net.testnet,
    explorer: `${net.explorer}/address/${address}`,
    eth: bal.eth,
    weth: bal.weth,
    usdc: bal.usdc,
    vaultUsdc: bal.vaultUsdc,
    ethUsd,
    valueUsd,
  },
  currentLevel: game.currentLevel,
  strategy: game.strategy,
  levels: game.levels,
  moves: game.moves
    .map((m) => ({ ...m, txUrl: m.tx ? `${getNetwork(m.network ?? game.network).explorer}/tx/${m.tx}` : undefined }))
    .sort((a, b) => b.at.localeCompare(a.at)),
};
writeFileSync(join(root, "dashboard/state.json"), JSON.stringify(state, null, 2) + "\n");
console.log(`state.json updated: ${bal.eth} ETH, ${bal.usdc} USDC, ~$${valueUsd?.toFixed(2)}`);
