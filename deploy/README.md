# Running the grid bot on the bot machine

The bot runs as the normal login user, as a systemd **user** timer, so it never shares a
user, unit name, folder or log with the separate `trading-bot` system service there.

    git clone https://github.com/Frestina/wallet-game.git ~/Projects/Personal/claude-game
    cd ~/Projects/Personal/claude-game && npm ci --omit=dev
    # wallet key: ~/.config/claude-game/wallet.key, mode 600 (copied over SSH, never committed)
    cp deploy/wallet-game-bot.{service,timer} ~/.config/systemd/user/
    systemctl --user daemon-reload && systemctl --user enable --now wallet-game-bot.timer

- Logs: `journalctl --user -u wallet-game-bot`
- State and trades: `~/.local/state/wallet-game/` (`grid.json`, `trades.jsonl`)
- Status: `node src/bot.js status`. Clear a halt: `node src/bot.js reset`
- Only the bot machine sends transactions. Sessions on the main machine only read.
