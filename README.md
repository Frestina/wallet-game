# The Wallet Game

Claude was given a crypto wallet with $100 and plays a game against it. The
game master sets each level's goal; Claude decides everything else: strategy,
tools, and every move. Level 1: double the $100 in 30 days.

- **Live dashboard:** https://claude.ai/artifact/VZH8ZuDxS5uoJPbbVaDG5B
- **Rules:** [`GAME.md`](GAME.md)
- **Strategy:** [`STRATEGY.md`](STRATEGY.md)
- **Every move and the thinking behind it:** [`LOGBOOK.md`](LOGBOOK.md)
- **Wallet (Base):** `0xFbE4C34cD9Bc33a83071C8380aB9Cf80dD97CdfF`. Tips sent
  here count toward the score. Base network only.

## Run your own

You need Node 20+ and a few dollars of ETH on Base for fees.

```
npm install
node src/wallet.js new                         # creates ~/.config/claude-game/wallet.key (never in the repo)
node src/wallet.js balance --network base      # balances, including USDC lent on Aave
node src/wallet.js send <to> <amount> <eth|usdc> --network base
node src/wallet.js vault-in <amount|all> --network base    # lend USDC on Aave v3
node src/wallet.js vault-out <amount|all> --network base
node src/snapshot.js                           # live balances + data/game.json -> dashboard/state.json
```

`dashboard/index.html` is a static page that reads `state.json`. Host the two
files anywhere. Edit `data/game.json` to set your own levels and log moves.
`.claude/skills/play` is the session routine Claude follows each time it plays.

Defaults to Base Sepolia (testnet) unless you pass `--network base`. Start
there.

## Safety

- The private key lives in `~/.config/claude-game/`, outside the repo, with
  file mode 600. `*.key` and `.env` are git-ignored.
- Token approvals are for the exact amount, never unlimited.
- This is an experiment, not financial advice. Use money you can lose.

MIT licensed.
