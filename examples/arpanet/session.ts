import os from "node:os";
import { randomUUID } from "node:crypto";
import figlet from "figlet";
import pc from "picocolors";
import { TelnetStream } from "tell";
import { authenticate, register, unregister } from "./users";
import { COMMANDS } from "./commands";

const PROMPT_DELAY_MS = 120;

const generateMotd = (): string => {
  const banner = figlet.textSync(os.hostname(), { font: "Small" });
  return [
    "",
    pc.cyan(banner),
    `  ${new Date().toDateString()}`,
    "  type 'help' for available commands",
    "",
  ].join("\r\n");
};

export class TelnetSession {
  public username = "";

  private sessionId = randomUUID().slice(0, 8);
  private client: TelnetStream;
  private log: Logger;
  private authState: "USERNAME" | "PASSWORD" | "SHELL" = "USERNAME";
  private lineBuffer = "";
  private pendingUsername = "";
  private isInterrupted = false;
  private isPaging = false;
  private pageResolve: (() => void) | null = null;

  constructor(client: TelnetStream, parentLogger: Logger) {
    this.client = client;
    this.log = parentLogger.child(this.sessionId);

    client.on("data", (chunk: Buffer) => this.handleData(chunk));
    client.on("interrupt", () => this.handleInterrupt());
    client.on("close", () => this.cleanup());
    client.on("error", (error: Error) => this.log.error(error.message));

    setTimeout(() => this.prompt(), PROMPT_DELAY_MS);
  }

  public writeLine(line: string): void {
    this.client.write(line + "\r\n");
  }

  public async writeLines(lines: string[]): Promise<void> {
    const pageSize = (this.client.windowSize?.[1] ?? 24) - 2;
    let lineCount = 0;

    for (const line of lines) {
      if (this.isInterrupted) { this.isInterrupted = false; return; }
      this.writeLine(line);
      lineCount++;

      if (lineCount >= pageSize) {
        lineCount = 0;
        const shouldContinue = await this.waitForPage();
        if (!shouldContinue) return;
      }
    }
  }

  public close(): void {
    this.cleanup();
    this.client.end();
  }

  private waitForPage(): Promise<boolean> {
    this.isPaging = true;
    this.client.write("--More-- (space to continue, q to quit) ");
    return new Promise((resolve) => {
      this.pageResolve = () => resolve(true);
    });
  }

  private prompt(): void {
    switch (this.authState) {
      case "USERNAME": this.client.write("login: "); break;
      case "PASSWORD": this.client.write("password: "); break;
      case "SHELL":    this.client.write(`${this.username}@${os.hostname()}$ `); break;
    }
  }

  private handleData(chunk: Buffer): void {
    const rawInput = chunk.toString("utf8");

    if (this.isPaging) {
      this.isPaging = false;
      this.client.write("\r\n");
      if (rawInput.toLowerCase().startsWith("q")) {
        this.isInterrupted = true;
        this.pageResolve = null;
      } else if (this.pageResolve) {
        const resolve = this.pageResolve;
        this.pageResolve = null;
        resolve();
      }
      return;
    }

    for (let characterIndex = 0; characterIndex < rawInput.length; characterIndex++) {
      const character = rawInput[characterIndex]!;
      if (character === "\r" || character === "\n") {
        if (character === "\r" && rawInput[characterIndex + 1] === "\n") characterIndex++;
        this.client.write("\r\n");
        this.processLine(this.lineBuffer.trim());
        this.lineBuffer = "";
      } else if (character === "\u007f" || character === "\b") {
        if (this.lineBuffer.length > 0) {
          this.lineBuffer = this.lineBuffer.slice(0, -1);
          this.client.write("\b \b");
        }
      } else {
        this.lineBuffer += character;
        if (this.authState !== "PASSWORD") this.client.write(character);
      }
    }
  }

  private processLine(line: string): void {
    if (this.authState === "USERNAME") {
      this.pendingUsername = line || (this.client.env["USER"] ?? "");
      this.authState = "PASSWORD";
      this.prompt();
      return;
    }

    if (this.authState === "PASSWORD") {
      if (authenticate(this.pendingUsername, line)) {
        this.username = this.pendingUsername;
        this.authState = "SHELL";
        this.log.info(`login: ${this.username}`);
        this.client.write(generateMotd() + "\r\n");

        register({
          id: this.sessionId,
          username: this.username,
          loginTime: new Date(),
          term: this.client.term,
          windowSize: this.client.windowSize,
          remoteAddress: this.client.env["DISPLAY"] ?? "unknown",
          deliver: (message) => this.client.write(message),
        });
      } else {
        this.log.warn(`failed login: "${this.pendingUsername}"`);
        this.client.write(pc.red("login incorrect") + "\r\n");
        this.authState = "USERNAME";
        this.pendingUsername = "";
      }
      this.prompt();
      return;
    }

    if (!line) { this.prompt(); return; }

    const [commandName, ...commandArgs] = line.split(/\s+/);
    const handler = COMMANDS[commandName ?? ""];
    if (handler) {
      Promise.resolve(handler(this, commandArgs)).then(() => {
        if (this.authState === "SHELL") this.prompt();
      });
    } else {
      this.writeLine(`${commandName}: command not found`);
      this.prompt();
    }
  }

  private handleInterrupt(): void {
    this.isInterrupted = true;
    if (this.isPaging && this.pageResolve) {
      this.isPaging = false;
      this.pageResolve = null;
      this.client.write("\r\n");
    }
    if (this.authState === "SHELL") this.prompt();
  }

  private cleanup(): void {
    if (this.username) {
      this.log.info(`logout: ${this.username}`);
      unregister(this.sessionId);
    }
  }
}
