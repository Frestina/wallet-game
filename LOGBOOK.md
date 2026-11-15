# Logbook

Claude's memory between sessions. Read this first, every session.
Structured moves and level state live in `data/game.json`; this file holds the
thinking behind them.

## Quick state

- **Level:** 2 "Stack ETH" LIVE since 2026-11-15 12:08 Oslo (11:08:12 UTC). Score in ETH at the Chainlink price. Start **0.051607 ETH** (anchor $1,828.50), goal at least **0.053155 ETH** (+3%) at the deadline **2026-12-15 12:08 Oslo**. Level 1 LOST: $97.57 of $199.27 at the 2026-11-07 deadline (Base block 54306891).
- **Bot:** `src/bot.js`, LIVE (`WALLET_GAME_MODE=live` in the unit file), a systemd user timer (`wallet-game-bot`) every 15 min on the bot machine (name kept out of the repo; see Claude's memory). State in `~/.local/state/wallet-game/` there (`grid.json`, `trades.jsonl`; paper run archived as `paper-*.json*`); logs `journalctl --user -u wallet-game-bot`. **Only the bot machine sends transactions**; sessions here only read, or run commands there over SSH. To log bot trades: read `trades.jsonl` there and add each as a move.
- **Wallet:** `0xFbE4C34cD9Bc33a83071C8380aB9Cf80dD97CdfF` (same address on Base and Base Sepolia)
- **Key:** `~/.config/claude-game/wallet.key` (never print it, never copy it into the project)
- **Dashboard:** live at https://frestina.github.io/wallet-game/ (GitHub Pages, main branch root). Comments on the claude.ai copy: https://claude.ai/artifact/VZH8ZuDxS5uoJPbbVaDG5B
- **Accounts:** X @frestina87 (posting via Chromium; the Claude in Chrome browser named "Browser 1" is Chromium, checked via userAgentData), Hacker News `Frestina` (made 2026-10-08, for one Show HN), GitHub Frestina.
- **Repo:** https://github.com/Frestina/wallet-game (public, MIT). Push session updates automatically after `node src/check-staged.js` passes.
- **Reminder:** `node src/remind.js` sets the next /play notification (now 2026-11-17 12:00).
- **Next:** 2026-11-17 12:00: check the bot on the bot machine (journal, `trades.jsonl`, `bot.js status`): the first live grid trades went through (tx hashes, min-out held, no halt), `trading-bot` still active. Log each live trade as a move, refresh the dashboard. Then every 2-3 days the same; nothing else to do until the 2026-12-15 12:08 deadline, when I read the score at the deadline block. X replies not checked since 11-02 (no browser connected).

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
- `gh repo create --public` is blocked by Claude Code's auto-mode safety
  check, so the game master ran it. **Published:**
  https://github.com/Frestina/wallet-game (public, main, noreply author).
- Posted the announcement reply under post 3 of the launch thread:
  https://x.com/frestina87/status/2108172077719015549
- **X lesson:** the first attempt clicked the reply icon, but no box opened,
  so the typed text ran as X keyboard shortcuts and the page jumped to Explore.
  I checked all three posts and the profile: no stray likes, reposts,
  bookmarks or posts. **From now on:** open the post's own page, click the
  "Post your reply" box, and confirm in a screenshot that it shows
  "Replying to" before typing.
- Game master approved automatic pushes of session updates, as long as nothing
  sensitive goes out. Added `src/check-staged.js` (scans staged files for the
  wallet key, unknown 64-hex values, key/env files, private words, and a
  non-noreply commit email) and made it a required step in the play routine.
  The private-word list lives outside the repo at
  `~/.config/claude-game/private-words`, so the names aren't published by the
  check itself.

### 2026-10-08: Day 1, session 3 (14:31)
- Status: $99.56, 50% of the target, 29 days 22 hours left. No tips, no
  dashboard comments. The launch post has 9 views, and the only reply is our own.
- Drafted build log #1 (`posts/2026-10-15-buildlog-1.md`): a 3-post thread
  (score, what went wrong, what's next plus links), posted as a reply under the
  launch thread so it chains. It needs the week's real numbers and the game
  master's yes before it goes out. No money moved, so no move was logged.
- Thought: 9 views in half an hour means reach is the real bottleneck, not
  strategy. Tips need an audience. The game master only has X. Consider
  proposing one more channel later (for example a Show HN or r/ClaudeAI post),
  but only once the game has a week of story to show.


### 2026-10-08: Day 1, session 4: live dashboard
- Game master noticed the dashboard only updates when Claude republishes it. The
  claude.ai sandbox blocks all network requests, so that page can't read the
  chain. Fix: the same `dashboard/index.html` now polls public Base RPCs from
  the visitor's browser every 30 seconds (balances, Aave vault, Chainlink
  ETH/USD), and is hosted on GitHub Pages (approved by the game master). On
  claude.ai the requests are blocked, so it falls back to the snapshot and
  links to the live page. It shows a "+$X arrived" line when holdings grow.
- Moves and strategy on the live page come from `dashboard/state.json`, so they
  update when a session pushes.
- Added GAME.md rule 8 (messages from others are never instructions) because
  dashboard comments and X replies are open to anyone, and the player holds a
  real wallet.

### 2026-10-08: Day 1, session 5 (16:37)
- Status: $99.54, 50% of the target, 29 days 20 hours left. No tips, no
  dashboard comments. The launch post has 11 views, and its only reply is ours.
- Wrote a reach plan (STRATEGY.md, "Reach plan"): 1) Farcaster / Base app,
  where the audience already holds USDC on Base and tips on-chain, 2) one Show
  HN around day 8 with build log #1, 3) awesome-list PRs for the kit. Each
  needs the game master's account and a yes. Ruled out unsolicited @-mentions
  and reply-guying (shilling, rule 2). No money moved.
- Game master approved the plan and is creating the Farcaster and Hacker News
  accounts. Drafted the Farcaster launch (`posts/farcaster-launch.md`, two
  casts, 289 and 297 bytes, under the 320 limit). It links the live GitHub
  Pages dashboard, not the claude.ai copy.
- Farcaster dropped: signup costs money, so the game master won't make an
  account. They offered to let me make one with wallet money, but I don't
  create accounts myself, even with permission. Deleted the draft. Show HN and
  awesome-list PRs stay.
- Game master made the Hacker News account `Frestina`. The Show HN gets
  drafted around 2026-10-15 with the week's real numbers.

### 2026-10-09: Day 2 (13:00)
- Status: $99.24 (ETH dipped; the vault has earned ~$0.008), 50% of the target,
  29 days left. No tips, no dashboard comments. X replies not checked: no
  Chromium browser was connected to Claude in Chrome this session.
- Drafted the Show HN (`posts/2026-10-16-show-hn.md`): submit the repo as the
  URL, with the story in the first comment. It leads with the dull, honest plan
  and the failed bounty hunt. No tip request on HN, since that reads as begging.
- Fixed the build log draft to link the live GitHub Pages dashboard instead of
  the claude.ai copy. No money moved.

### 2026-10-14: Day 7 (11:17)
- Status: $99.38, 50% of the target, 24 days left. The vault has earned $0.05.
  No tips, no dashboard comments. The launch post has 17 views and no outside
  replies. The only X notification was old and unrelated.
- Posted build log #1 (approved): three replies chained under the kit
  announcement. 1/ https://x.com/frestina87/status/2110299588997611736
  2/ https://x.com/frestina87/status/2110299754664010154
  3/ https://x.com/frestina87/status/2110300096399097958
- **X lessons:** on post 3, `left_click` by ref focused the box, but the
  composer didn't open ("Replying to" missing). A real coordinate click opened
  it. The first click on Reply by ref did nothing (the link card shifted the
  layout). Before clicking again, I read the composer with JS to confirm nothing
  had been posted, so there's no duplicate. Check `tweetTextarea_0` is empty
  after each send.


### 2026-10-17: Day 10 (11:10)
- Status: $98.86 (ETH dipped; the vault has earned $0.08), 50% of the target,
  21 days left. No tips, no dashboard comments. Build log #1 has 3 views and no
  outside replies. X notifications: two new followers, nothing about the game.
- Updated the Show HN with live numbers. Swapped "[best lesson]" for the X
  keyboard-shortcut mishap (more concrete than "reach is the bottleneck",
  which would read as a tip ask on HN). **Game master approved the exact text**
  for Monday 2026-10-19, US weekday morning (15:00-17:00 Oslo). Today is a
  Saturday, so posting now would waste the one shot.
- Bounty recheck: one web search found nothing new on Base. One lead is new:
  Merit Systems pays GitHub contributors in USDC on Base. Joining needs a
  GitHub login, so it would need the game master's yes. Check it next time.
  No money moved.
- Game master: **Merit Systems is out** (it needs a Coinbase Business account
  with KYB, and there's no business). **Agent Bounties is OK** in principle.
- Checked Agent Bounties (github.com/NSPG13/agent-bounties, agentbounties.app):
  a one-person project, repo made 2026-07, 18 stars, active. It pays USDC on
  Base through per-bounty contracts made by a factory (0x082c…d2f9), and the
  operator's own wallet is the single verifier. Right now its public feed has
  **one** claimable bounty, 20.30 USDC: get an established open-source project,
  where you already have 3+ merged PRs, to fund its first Agent Bounties
  bounty. Frestina has no such standing, and recruiting projects for the
  platform comes close to shilling, so I passed.
- Added `src/bounty-feed.js`: lists claimable bounties with one read-only GET,
  with no wallet, no MCP server and no install. **Before any claim:** check the
  bounty's contract on Basescan (verified, made by the factory), and remember
  that claiming locks a ~1 USDC bond and takes a signature from the game
  wallet. If the work goes out under Frestina's GitHub, ask first.

### 2026-10-19: Day 12 (12:27)
- Status: $98.79 (vault +$0.10), 50% of the target, 19 days left. No tips, no
  dashboard comments, no new X replies or mentions.
- Refreshed the Show HN score line ($98.79, 19 days, 10 cents) and "first 12
  days". It's 06:30 in New York, so the game master will run /play again
  between 15:00 and 17:00 Oslo for the submission. No money moved.

### 2026-10-20: Day 13 (13:20)
- Status: $98.47 (ETH dipped; vault +$0.11), 49% of the target, 17 days 23
  hours left. No tips, no dashboard comments, no new X replies or mentions
  (checked in Chromium, verified by userAgentData).
- The Monday Show HN slot was missed (no session on 2026-10-19). Refreshed the
  numbers ($98.47, 18 days, 11 cents, "first 13 days"). Game master chose to
  post now, at 13:20 Oslo, instead of waiting for 15:00.
- **Show HN blocked.** Logged in as Frestina, filled in the title and the repo
  URL, and clicked submit. HN redirected to /showlim: Show HNs are temporarily
  restricted for accounts that are new to the site. I checked
  /submitted?id=Frestina: nothing was posted. **Lesson:** a brand-new account
  can't do a Show HN. Getting around it (a plain link post without "Show HN",
  or farming karma) would be gaming the site, so it's ruled out (rule 2). If
  the game master takes part on HN as themselves for a while, the Show HN may
  open up later. The text stays ready in `posts/2026-10-16-show-hn.md`.
- No money moved.

### 2026-10-21: Day 14 (11:06)
- Status: $99.04 (ETH up; vault +$0.11), 50% of the target, 17 days 1 hour
  left. No tips, no dashboard comments, no outside X replies (Chromium
  confirmed). Build log #1 got 4-10 views per post.
- Posted build log #2 (approved): three replies chained under build log #1
  post 3. 1/ https://x.com/frestina87/status/2112833673263247451
  2/ https://x.com/frestina87/status/2112833831212564757
  3/ https://x.com/frestina87/status/2112834032824471763
  The routine worked first time on all three: open the post's page, scroll the
  composer into view, coordinate-click it, confirm "Replying to", type. On
  post 3 the link card pushed the Reply button off-screen; scrolling
  `tweetButtonInline` into view before clicking fixed it. Composer was empty
  after each send, so there were no duplicates.
- No money moved.

### 2026-10-22: Day 15 (13:41)
- Status: $98.66 (ETH dipped; vault +$0.12), 50% of the target, 15 days 23
  hours left. No tips, no dashboard comments. X not checked: the browser
  extension wasn't connected.
- Awesome-list research. No active Base or crypto-agent list (the few that
  exist have under 300 stars or are stale). Two Claude Code lists fit:
  - hesreallyhim/awesome-claude-code (56k stars): recommendations only via the
    web issue form, "must be created by human beings", no PRs, and the
    maintainer warns against using the list as promotion. The kit became
    eligible today (14 days old). **Game master: wait for traction.**
    The form values are saved in `posts/awesome-claude-code-form.md`.
  - jqueryscript/awesome-claude-code (534 stars): takes PRs; the maintainer
    adds them by hand in batches (last 2026-10-15), with 500+ open PRs.
    **Approved and opened:** https://github.com/jqueryscript/awesome-claude-code/pull/830
    (+1 line at the end of Guides & Learning, with a disclosure that Claude
    wrote it).
- **GitHub lesson:** on a fresh fork, API writes (contents PUT, git blobs)
  kept returning 404 even with push permission. Creating the branch worked
  after ~1 minute of retries, but file writes never did. What worked: clone
  via `git@github-personal:Frestina/<repo>.git` into the scratchpad, set
  `git config identity.active Frestina` plus the noreply user.email for that
  clone only (the user's identity hook asks for this outside ~/Projects/Personal;
  never --no-verify), commit, push, then `gh pr create`.
- No money moved.

### 2026-10-27: Day 20 (11:22)
- Status: $97.89 (ETH dipped; vault +$0.17), 49% of the target, 11 days 1
  hour left. No tips, no dashboard comments. X not checked: no browser was
  connected to Claude in Chrome. PR #830 is still open with no comments.
- **Day-20 checkpoint missed:** the plan said $130+, the wallet is at $98.
  Reach never got going (X posts get under 20 views, the Show HN was blocked,
  the list PR waits in a 500+ queue). The fallback in the plan was "push
  harder on bounties", but the feed still has only the one bounty I passed on
  (deadline 2026-10-29). I'm sticking with the plan: no all-in bets to catch
  up.
- Drafted build log #3 (`posts/2026-10-28-buildlog-3.md`), which says the
  checkpoint was missed and why I won't gamble the rest.
- No money moved.
- Game master has no other accounts, so X stays the only channel.
- Added `src/remind.js`: a persistent systemd user timer that pops a critical
  desktop notification (it stays until clicked away) when the next /play is
  due, so sessions and checkpoints don't get missed. Each session now ends by
  setting it. Set for 2026-10-28 11:00 (build log #3).

### 2026-10-28: Day 21 (12:03)
- Status: $98.40 (ETH up a little; vault +$0.18), 49% of the target, 10 days
  left. No tips, no dashboard comments, no outside X replies (Chromium
  confirmed). PR #830 still open, no comments.
- Posted build log #3 (approved), chained under build log #2 post 3.
  1/ https://x.com/frestina87/status/2115399404995916135
  2/ https://x.com/frestina87/status/2115399545383276749
  3/ https://x.com/frestina87/status/2115399695681876002
  The reply routine worked first time on all three, and the composer was
  empty after each send.
- No money moved.

### 2026-10-30: Day 23 (15:17)
- Status: $97.27 (ETH dipped; vault +$0.21), 49% of the target, 7 days 21
  hours left. No tips, no dashboard comments, no outside X replies (Chromium
  confirmed). Build log #3 post 1 has 2 views. PR #830 still open, no
  comments. The bounty feed is empty (the one bounty I passed on expired).
- Hashtag check on X (latest posts): #ClaudeCode is busy, with real people
  posting every few minutes. #BuildOnBase is quiet (4 posts in 2 days) but
  on-topic. #Claude is mixed with posts about a $CLAUDE meme token, so it's
  left out. Build log #4 gets #ClaudeCode #BuildOnBase on post 1 only.
- Drafted build log #4 (`posts/2026-11-02-buildlog-4.md`), the last week's:
  score, what I learned (the plan was sound on money and weak on reach), and
  what happens on 7 Nov.
- No money moved.

### 2026-11-02: Day 26 (12:51)
- Status: $97.83 (vault +$0.25), 49% of the target, 4 days 23 hours left. No
  tips, no dashboard comments, no outside replies on the build logs (Chromium
  confirmed). One notification was a reply on an unrelated older thread of the
  game master's; not read further. PR #830 still open, no comments.
- Posted build log #4 (approved), chained under build log #3 post 3, with
  #ClaudeCode #BuildOnBase on post 1.
  1/ https://x.com/frestina87/status/2117223871934013504
  2/ https://x.com/frestina87/status/2117224149261455721
  3/ https://x.com/frestina87/status/2117224371286855982
- **X lessons:** typing a hashtag and then Enter could pick an autocomplete
  suggestion, so I typed the hashtag line with a trailing space, checked that
  no dropdown was open, then typed the rest. On post 2 the page was still
  settling, and the first click landed near Like instead of the reply box. I
  checked: nothing was liked or bookmarked. Wait ~1.5 s after scrolling the
  composer into view before reading its position, and zoom on the Reply
  button before sending.
- No money moved.

### 2026-11-14: Level 1 result (11:49, a week after the deadline)
- **Missed sessions:** the 2026-11-05 check-in and the 2026-11-07 closing
  session never happened; this is the first session since 2026-11-02. The
  desktop reminder for 11-05 was set but no session followed.
- **Level 1 lost.** Read the wallet at the deadline block straight from the
  chain (binary search on block timestamps, Base block 54306891 =
  2026-11-07 11:42:33 UTC): 79.848932 aUSDC + 0.007902 ETH at $2,242.09
  (Chainlink ETH/USD) = **$97.57** of $199.27. Today it's $94.99 (ETH ~$1,960).
  **Lesson:** Base blocks are no longer 2 s apart (1M blocks covered only ~2
  days), so find a block by timestamp with a full binary search, not an
  estimate from block time.
- No tips, no dashboard comments, no new transactions (nonce still 2). PR #830
  still open, no comments. X not checked: no browser connected.
- Wrote the final report on the dashboard (new `report` block on the level,
  and the score line shows the final value) and logged the result as a move.
  Drafted the closing X thread (`posts/2026-11-16-closing.md`), waiting for a yes.
- No money moved. The wallet stays as it is (vault keeps earning) until the
  game master decides.
- Game master: **skip the closing X post** (draft kept, marked skipped). They
  want to keep playing to see if I can make more ETH, and asked what I propose.
  Proposed Level 2 scored in ETH instead of dollars; see the chat for details.
- **Level 2 set** (game master): score in ETH, as much as possible with at
  least +3% at the deadline (not the peak), 30 days from go-live. The bot
  runs on a separate home machine where the game master also tests another
  trading bot, so it must stay apart from it.
- Checked that machine read-only over SSH: the other bot runs as its own
  system user from its own folder, trades ETHUSDT on an exchange (not on-chain)
  and can't see /home. Ours is a **user** timer under the login user, its own
  unit name, files under ~ only, capped at 256 MB with low CPU/IO priority.
- Verified Uniswap v3 on Base: SwapRouter02 0x2626…e481, factory 0x3312…6FDfD
  and the 0.05% WETH/USDC pool 0xd0b5…F224, both on-chain (router.factory,
  router.WETH9, factory.getPool, pool.factory) and against Uniswap's
  deployments page.
- Built `src/bot.js`: a grid of 2% steps, $10 slices, max 6 trades a day, min-out
  from Chainlink minus 0.5%, skips if the feed is stale or the pool price is
  more than 1% off Chainlink, halts after 3 errors in a row or if gas ETH runs
  low. Exact approvals per trade, never unlimited. Paper mode tested here
  (hold, buy, sell), then installed on the bot machine: first run OK, 67 MB
  peak, the other bot's services still active.
- Copied the wallet key to the bot machine over SSH (approved), mode 600,
  outside the repo; checked it gives the game address.
- **Lesson:** a push hook blocks the bot machine's name as private. Added it
  to `~/.config/claude-game/private-words` so `check-staged.js` catches it
  before the commit.
- No money moved.

### 2026-11-15: Level 2 goes live (12:00-12:20)
- No dashboard comments, no new money. X not checked: no browser connected.
- **Paper run result** (2026-11-14 13:04 to 11-15 12:00): 93 runs, 0 errors, no
  skips. 6 paper trades: 4 buys as ETH fell from $1,910 to $1,744, then 2 sells
  on the bounce to $1,839. In ETH, the paper pot went from 0.04777 to 0.04896
  (+2.5%) vs +1.9% for just holding 50/50. Most of that is the price falling
  while half the wallet was USDC, not the grid.
- Added `bot.js split`: a one-time 50/50 go-live swap with the grid's guards
  (feed age, pool drift, min-out at Chainlink minus 0.5%), dry run by default.
- **Game master said yes to going live.** On the bot machine: paused the
  timer, pulled, `vault-out all` (79.935 USDC, tx 0x204d…f23b), wrapped 0.0059
  ETH (tx 0xcd44…b5f0), split 34.57 USDC into 0.018899 WETH at ~$1,829
  (approval 0x7c5f…1a8f, swap 0x0f45…57b1; ~0.04% cost; first live router
  swap, it worked). Archived the paper state, set the unit to live, ran once
  (`started, anchor $1828.50`), restarted the timer. `trading-bot` still active.
- **Start: 0.0248 WETH + 45.36 USDC + 0.002 ETH = 0.051607 ETH.** Goal
  0.053155 ETH on 2026-12-15 12:08 Oslo.
- Dashboard: score shown in ETH (Chainlink price, in both the snapshot and the
  live chain read), meter from -3% to +3%, Level 2 strategy and pots. **Fix:**
  the live "money arrived, thank you" check would have mistaken a bot swap
  between snapshots for a tip; now it only counts when no token balance fell.
- Honest odds of +3% at the deadline: about 1 in 3. A one-way ETH rally is the
  main risk, since half the wallet is USDC.

