# Logbook

Claude's memory between sessions. Read this first, every session.
Structured moves and level state live in `data/game.json`; this file holds the
thinking behind them.

## Quick state

- **Level:** 1 ACTIVE. Started 2026-10-08 13:42:33 (Oslo), deadline 2026-11-07 12:42:33 (Oslo, CET). Start $99.64, target $199.27.
- **Wallet:** `0xFbE4C34cD9Bc33a83071C8380aB9Cf80dD97CdfF` (same address on Base and Base Sepolia)
- **Key:** `~/.config/claude-game/wallet.key` (never print it, never copy it into the project)
- **Dashboard:** https://claude.ai/artifact/VZH8ZuDxS5uoJPbbVaDG5B
- **Next:** plan the first weekly build-log post (due ~2026-10-15). Recheck bounties weekly (next ~2026-10-15). Check X replies and dashboard comments each session.

## How to update the dashboard

1. Edit `data/game.json` (moves, checklist, strategy, level status).
2. `node src/snapshot.js` to pull live balances into `dashboard/state.json`.
3. Republish `dashboard/index.html` with `files: {"state.json": "dashboard/state.json"}`.

## Journal

### 2026-10-08: Day 1, setup
- Game master set the rules: Level 1 = double $100. Anything legal counts
  (trading, building and selling tools, bounties, tips). Spending needs no
  approval. Using the game master's name or accounts needs approval.
- Picked Base: cents-level fees, viem tooling, public explorer, native USDC.
- Built `src/wallet.js` (new, address, balance, send, wrap) and
  `src/snapshot.js`, created the wallet, published the dashboard.
- Faucets (ethereum-ecosystem.com etc.) return HTTP 402 to scripts and
  need a human click. Asked the game master to claim test coins.
- Next: once test ETH lands, wrap 0.001 ETH into WETH, log it, finish Level 0.
  Then plan the Level 1 strategy before real money goes in.
- 12:10: 20 test USDC arrived, but 0 ETH, so no transaction is possible.
  **Lesson for Level 1:** fund with mostly USDC plus ~$3-5 of ETH for gas.
- Game master is on the Claude Pro plan. Sessions are limited, so the strategy
  must not need constant attention: no high-frequency trading. Anything that has
  to run continuously should be a plain script or cron job, not a Claude session.
- Test ETH arrived (0.04). Wrapped 0.001 ETH into WETH (tx 0x2b42…3063) and sent
  1 USDC to self (tx 0x3817…c4). Both succeeded. Combined gas was about
  0.0000005 ETH, so fees are negligible on Base.
- **Level 0 won.**
- Wrote the Level 1 strategy (`STRATEGY.md`): pots of $80 vault (Aave USDC),
  $5 fuel ETH, $15 risk pot. The earning engines are the game as a story with
  tips, bounties, and an open-source game kit. Odds about 1 in 5.
  Research: Base Builder Rewards (Talent Protocol) seem to have ended in Jan
  2026. Aave USDC on Base is about 3.8%. Bounty sources: Algora,
  Collaborators.build.
- Waiting on the game master: approval to make the dashboard public and post
  about it (which accounts?), approval to use GitHub for bounties, and funding.
- Game master approved all three: public dashboard plus X posts (X is the only
  account), GitHub (Frestina) for bounties with approval per bounty, and funding.
- **Level 1 started 13:42:33.** Received 79.55 USDC + 0.0079 ETH = $99.64. The
  target is 2x the start value = $199.27.
- Verified Aave v3 Base on-chain (pool 0xA238…d1c5, aBasUSDC 0x4e65…c0AB,
  3.81%). Approved the exact amount, then supplied all 79.55 USDC. The first
  supply attempt failed in simulation because of public RPC lag after the
  approve. Fixed: the tool now waits for the allowance to show up.
- Dashboard: Level 1 live, vault row, tip jar (Base only).
- Drafted the launch X thread in posts/, waiting for approval.
- Posted the launch thread on X (@frestina87) via Claude in Chrome (use the
  Chromium browser, not Brave): https://x.com/frestina87/status/2108167511074308525

### 2026-10-08: Day 1, session 2 (14:13)
- Status: $99.58 (ETH price wobble). No tips, no dashboard comments. The X
  thread had 2 views and no replies a few minutes after posting.
- **Bounty search, verdict: not worth it right now.** GitHub issues with the
  Algora "💎 Bounty" label are mostly bait: SecureBananaLabs ($430-$1k on toy
  code), ClankerNation ("Autonomous Agents Only", $2k-$8k), and the like. Real
  orgs (tscircuit, highlight, outerbase) have stale issues with 40 to 100+
  attempts each. Algora's public board is gone (404); the homepage now shows
  hiring challenges. Collaborators.build pays USDC on Solana, needs a GitHub
  login, and lists nothing open. **Lesson:** the bounty market in 2026 is
  swarmed by AI agents. Don't count on it. Recheck weekly for fresh, real ones.
- Fixed `snapshot.js` crashing with "over rate limit" from mainnet.base.org.
  Batched JSON-RPC didn't help (the limit counts each call). The fix: Multicall3
  (all balance reads in one eth_call) plus fallback RPCs (publicnode, drpc) in
  `networks.js`.
- Prepared the game kit for open-sourcing: secret scan clean (only tx hashes),
  README with "Run your own", MIT LICENSE. Waiting on approval to create a
  public GitHub repo under Frestina and push.
- Game master approved open-sourcing. Commits use the GitHub noreply email
  (repo-local git config), and the game master's name is removed from GAME.md.
  Keep personal names and emails out of the repo from now on.
