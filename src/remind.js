#!/usr/bin/env node
// Schedules a desktop reminder for the game master's next /play.
//   node src/remind.js "2026-10-28 15:00" "Post build log #3"   set (replaces any earlier one)
//   node src/remind.js show | clear
// A persistent systemd user timer, so it still fires after a reboot or on wake if the time
// passed while the laptop was off. Critical urgency: Omarchy keeps it until it's clicked away.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const UNIT = "wallet-game-play";
const dir = join(homedir(), ".config/systemd/user");
const ctl = (...args) => execFileSync("systemctl", ["--user", ...args], { encoding: "utf8" });
// systemd unit quoting: backslash and double quote escaped, % and $ doubled.
const quote = (s) => '"' + s.replace(/[\r\n]+/g, " ").replace(/[\\"]/g, "\\$&").replace(/%/g, "%%").replace(/\$/g, "$$$$") + '"';

const [cmd, note = ""] = process.argv.slice(2);

if (!cmd || cmd === "show") {
  console.log(ctl("list-timers", "--all", `${UNIT}.timer`).trim());
} else if (cmd === "clear") {
  try { ctl("disable", "--now", `${UNIT}.timer`); } catch {}
  rmSync(join(dir, `${UNIT}.timer`), { force: true });
  rmSync(join(dir, `${UNIT}.service`), { force: true });
  ctl("daemon-reload");
  console.log("Reminder cleared.");
} else {
  const when = cmd.length === 16 ? cmd + ":00" : cmd; // "YYYY-MM-DD HH:MM" -> add seconds
  if (!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(when)) throw new Error(`time must be "YYYY-MM-DD HH:MM", got "${cmd}"`);
  if (new Date(when.replace(" ", "T")) <= new Date()) throw new Error(`${when} is in the past`);

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${UNIT}.service`), `[Unit]
Description=Wallet Game: time to /play

[Service]
Type=oneshot
ExecStart=/usr/bin/notify-send -u critical -a notify-send ${quote("Wallet Game: time to /play")} ${quote(note || "Open Claude Code in claude-game and type /play.")}
`);
  writeFileSync(join(dir, `${UNIT}.timer`), `[Unit]
Description=Wallet Game: next /play reminder

[Timer]
OnCalendar=${when}
Persistent=true

[Install]
WantedBy=timers.target
`);
  ctl("daemon-reload");
  ctl("enable", `${UNIT}.timer`);
  ctl("restart", `${UNIT}.timer`); // picks up a changed time if the timer was already active
  console.log(`Reminder set for ${when}: ${note}`);
}
