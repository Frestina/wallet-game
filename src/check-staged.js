#!/usr/bin/env node
// Run before every push: fails if a staged file holds anything sensitive.
// Checks: the wallet key itself, key-like hex that isn't a logged tx hash,
// key/env files, a non-noreply commit email, and personal details listed in ~/.config/claude-game/private-words.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const cfg = join(homedir(), ".config", "claude-game");
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });

const files = git("diff", "--cached", "--name-only", "--diff-filter=ACMR").split("\n").filter(Boolean);
const key = existsSync(join(cfg, "wallet.key")) ? readFileSync(join(cfg, "wallet.key"), "utf8").trim().replace(/^0x/, "").toLowerCase() : null;
const privateWords = existsSync(join(cfg, "private-words"))
  ? readFileSync(join(cfg, "private-words"), "utf8").split("\n").map((w) => w.trim()).filter(Boolean)
  : [];
const txHashes = new Set(
  JSON.parse(readFileSync(join(root, "data/game.json"), "utf8")).moves.filter((m) => m.tx).map((m) => m.tx.toLowerCase()),
);

const problems = [];
if (!git("config", "user.email").trim().endsWith("@users.noreply.github.com")) problems.push("git user.email is not the GitHub noreply address");
for (const f of files) {
  if (/\.(key|pem)$|(^|\/)\.env/.test(f)) problems.push(`${f}: key or env file`);
  const text = git("show", `:${f}`);
  const lower = text.toLowerCase();
  if (key && lower.includes(key)) problems.push(`${f}: contains the wallet private key`);
  for (const hex of lower.match(/0x[0-9a-f]{64}\b/g) ?? []) {
    if (!txHashes.has(hex)) problems.push(`${f}: 64-hex value that is not a logged tx hash (${hex.slice(0, 10)}…)`);
  }
  for (const w of privateWords) {
    const word = new RegExp(`(^|[^a-z0-9])${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
    if (word.test(lower)) problems.push(`${f}: contains a private word`);
  }
}

if (problems.length) {
  console.error("Not safe to push:\n- " + [...new Set(problems)].join("\n- "));
  process.exit(1);
}
console.log(`OK: ${files.length} staged file(s), nothing sensitive found.`);
