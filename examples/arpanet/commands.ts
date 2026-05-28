import { execSync } from "node:child_process";
import os from "node:os";
import Table from "cli-table3";
import { getConnected, findByUsername } from "./users";
import { TelnetSession } from "./session";

const COMMAND_TIMEOUT_MS = 5000;

const BORDERLESS_TABLE_CHARS = {
  top: "", "top-mid": "", "top-left": "", "top-right": "",
  bottom: "", "bottom-mid": "", "bottom-left": "", "bottom-right": "",
  left: "", "left-mid": "", mid: "", "mid-mid": "",
  right: "", "right-mid": "", middle: " ",
};

const runShellCommand = (command: string): string => {
  try {
    return execSync(command, { encoding: "utf8", timeout: COMMAND_TIMEOUT_MS }).trim();
  } catch {
    return `command failed: ${command}`;
  }
};

interface CommandHandler {
  (session: TelnetSession, args: string[]): void | Promise<void>;
}

export const COMMANDS: Record<string, CommandHandler> = {
  date: (session) => {
    session.writeLine(new Date().toString());
  },

  uptime: (session) => {
    session.writeLine(runShellCommand("uptime"));
  },

  ps: async (session) => {
    await session.writeLines(runShellCommand("ps aux").split("\n"));
  },

  df: async (session) => {
    await session.writeLines(runShellCommand("df -h").split("\n"));
  },

  who: (session) => {
    const connectedSessions = getConnected();
    if (connectedSessions.length === 0) { session.writeLine("no users connected"); return; }

    const table = new Table({
      chars: BORDERLESS_TABLE_CHARS,
      style: { "padding-left": 0, "padding-right": 2 },
    });

    for (const entry of connectedSessions) {
      const elapsedSeconds = Math.floor((Date.now() - entry.loginTime.getTime()) / 1000);
      const windowDimensions = entry.windowSize ? `${entry.windowSize[0]}x${entry.windowSize[1]}` : "unknown";
      table.push([
        entry.username,
        entry.term ?? "unknown",
        windowDimensions,
        `${elapsedSeconds}s ago`,
        entry.remoteAddress,
      ]);
    }

    session.writeLine(table.toString());
  },

  finger: (session, args) => {
    const targetUsername = args[0];
    if (!targetUsername) { session.writeLine("usage: finger <username>"); return; }
    const targetInfo = findByUsername(targetUsername);
    if (!targetInfo) { session.writeLine(`finger: ${targetUsername}: no such user connected`); return; }

    const elapsedSeconds = Math.floor((Date.now() - targetInfo.loginTime.getTime()) / 1000);
    const table = new Table({
      chars: BORDERLESS_TABLE_CHARS,
      style: { "padding-left": 0, "padding-right": 1 },
    });

    table.push(
      ["Login:", targetInfo.username],
      ["Terminal:", targetInfo.term ?? "unknown"],
      ["Window:", targetInfo.windowSize ? `${targetInfo.windowSize[0]}x${targetInfo.windowSize[1]}` : "unknown"],
      ["Connected:", `${targetInfo.loginTime.toISOString()} (${elapsedSeconds}s ago)`],
      ["From:", targetInfo.remoteAddress],
    );

    session.writeLine(table.toString());
  },

  write: (session, args) => {
    const [targetUsername, ...messageParts] = args;
    if (!targetUsername || messageParts.length === 0) { session.writeLine("usage: write <username> <message>"); return; }
    const targetInfo = findByUsername(targetUsername);
    if (!targetInfo) { session.writeLine(`write: ${targetUsername}: not connected`); return; }
    targetInfo.deliver(`\r\nMessage from ${session.username}: ${messageParts.join(" ")}\r\n`);
    session.writeLine(`message sent to ${targetUsername}`);
  },

  wall: (session, args) => {
    if (args.length === 0) { session.writeLine("usage: wall <message>"); return; }
    const broadcastMessage = args.join(" ");
    const allSessions = getConnected();
    for (const entry of allSessions) {
      entry.deliver(`\r\nBroadcast from ${session.username}: ${broadcastMessage}\r\n`);
    }
    session.writeLine(`broadcast sent to ${allSessions.length} user(s)`);
  },

  echo: (session, args) => {
    session.writeLine(args.join(" "));
  },

  hostname: (session) => {
    session.writeLine(os.hostname());
  },

  help: (session) => {
    session.writeLine("available commands:");
    for (const name of Object.keys(COMMANDS).sort()) {
      session.writeLine(`  ${name}`);
    }
  },

  logout: (session) => {
    session.writeLine("goodbye.");
    session.close();
  },
};
