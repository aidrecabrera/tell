import os from "node:os";
import Table from "cli-table3";
import { Server, TelnetStream } from "tell";
import {
  formatMiB,
  getCpuCount,
  getCpuModel,
  getNetworkAddress,
  getNetworkInterfaces,
  getPrefixLength,
  getUptime,
} from "./hardware";
import { parseKeyValue } from "./parse-key-value";

const PROMPT_DELAY_MS = 120;
const PING_INTERVAL_MS = 1000;

const BANNER = [
  "  MMM      MMM       KKK                          TTTTTTTTTTT      KKK",
  "  MMMM    MMMM       KKK                          TTTTTTTTTTT      KKK",
  "  MMM MMMM MMM  III  KKK  KKK  RRRRRR   OOOOOO        TTT     III  KKK  KKK",
  "  MMM  MM  MMM  III  KKKKK     RRR  RR OOO  OOO       TTT     III  KKKKK",
  "  MMM      MMM  III  KKK KKK   RRRRRR  OOO  OOO       TTT     III  KKK KKK",
  "  MMM      MMM  III  KKK  KKK  RRR  RR  OOOOOO        TTT     III  KKK  KKK",
  "",
  "  MikroTik RouterOS 7.15 (c) 1999-2024 http://www.mikrotik.com/",
  "",
].join("\r\n");

const MENU_PATHS = new Set([
  "", "ip", "ip/address", "interface", "system", "system/identity", "system/resource",
]);

const BORDERLESS_TABLE_CHARS = {
  top: "", "top-mid": "", "top-left": "", "top-right": "",
  bottom: "", "bottom-mid": "", "bottom-left": "", "bottom-right": "",
  left: "", "left-mid": "", mid: "", "mid-mid": "",
  right: "", "right-mid": "", middle: " ",
};

interface CommandHandler {
  (session: RouterSession, args: string[]): void;
}

class CommandRouter {
  private handlers: Record<string, CommandHandler> = {};

  public register(path: string, handler: CommandHandler): void {
    this.handlers[path] = handler;
  }

  public resolve(basePath: string[], tokens: string[]): { path: string[]; command: string; args: string[] } {
    const path = basePath.slice();
    let tokenIndex = 0;

    while (tokenIndex < tokens.length) {
      const token = tokens[tokenIndex]!;
      if (token === "/") { path.length = 0; tokenIndex++; continue; }
      if (token === "..") { path.pop(); tokenIndex++; continue; }

      const candidate = [...path, token.toLowerCase()].join("/");
      if (!MENU_PATHS.has(candidate)) break;
      path.push(token.toLowerCase());
      tokenIndex++;
    }

    const command = tokens[tokenIndex]?.toLowerCase() ?? "";
    return { path, command, args: tokens.slice(tokenIndex + 1) };
  }

  public execute(session: RouterSession, path: string[], command: string, args: string[]): void {
    if (!command) {
      session.setMenu(path);
      session.prompt();
      return;
    }

    if (command === "quit") {
      session.write("Connection closed.\r\n");
      session.close();
      return;
    }

    const fullPath = "/" + [...path, command].join("/");
    const handler = this.handlers[fullPath];
    if (handler) {
      handler(session, args);
    } else {
      session.write("bad command name " + command + " (line 1 column 1)\r\n");
      session.prompt();
    }
  }
}

class RouterSession {
  private client: TelnetStream;
  private log: Logger;
  private authState: "LOGIN_USER" | "LOGIN_PASS" | "SHELL" = "LOGIN_USER";
  private identityName = "MikroTik";
  private menuPath: string[] = [];
  private lineBuffer = "";
  private pingTimer: NodeJS.Timeout | null = null;
  private router: CommandRouter;

  constructor(client: TelnetStream, router: CommandRouter, logger: Logger) {
    this.client = client;
    this.router = router;
    this.log = logger;

    this.client.on("data", (chunk: Buffer) => this.handleData(chunk));
    this.client.on("interrupt", () => this.handleInterrupt());
    this.client.on("error", (error: Error) => this.log.error(error.message));
    this.client.on("close", () => this.cleanup());

    setTimeout(() => { this.write("\r\n"); this.prompt(); }, PROMPT_DELAY_MS);
  }

  public write(data: string): void {
    this.client.write(data);
  }

  public close(): void {
    this.cleanup();
    this.client.end();
  }

  public setMenu(path: string[]): void {
    this.menuPath = path;
  }

  public getIdentity(): string {
    return this.identityName;
  }

  public setIdentity(name: string): void {
    this.identityName = name;
  }

  public writeResourceLine(label: string, value: string): void {
    const padding = " ".repeat(25 - label.length);
    this.write(padding + label + ": " + value + "\r\n");
  }

  public startPing(ipAddress: string): void {
    this.write("  SEQ HOST                                     SIZE TTL TIME  STATUS\r\n");
    let sequenceNumber = 0;
    this.pingTimer = setInterval(() => {
      this.write("    " + sequenceNumber + " " + ipAddress + "                                    56  64 12ms\r\n");
      sequenceNumber++;
    }, PING_INTERVAL_MS);
  }

  public prompt(): void {
    switch (this.authState) {
      case "LOGIN_USER":
        this.write("MikroTik 7.15\r\nLogin: ");
        break;
      case "LOGIN_PASS":
        this.write("Password: ");
        break;
      case "SHELL": {
        const menuDisplay = this.menuPath.length > 0 ? " /" + this.menuPath.join(" ") : "";
        this.write(`[admin@${this.identityName}]${menuDisplay} > `);
        break;
      }
    }
  }

  private handleData(chunk: Buffer): void {
    if (this.pingTimer) {
      this.cleanup();
      this.write("\r\n");
      this.prompt();
      return;
    }

    const rawInput = chunk.toString("utf8");
    for (let characterIndex = 0; characterIndex < rawInput.length; characterIndex++) {
      const character = rawInput[characterIndex]!;

      if (character === "\r" || character === "\n") {
        if (character === "\r" && rawInput[characterIndex + 1] === "\n") characterIndex++;
        this.processLine(this.lineBuffer.trim());
        this.lineBuffer = "";
      } else if (character === "\u007f" || character === "\b") {
        if (this.lineBuffer.length > 0) {
          this.lineBuffer = this.lineBuffer.slice(0, -1);
          this.write("\b \b");
        }
      } else {
        this.lineBuffer += character;
        if (this.authState !== "LOGIN_PASS") this.write(character);
      }
    }
  }

  private processLine(line: string): void {
    this.write("\r\n");

    if (this.authState === "LOGIN_USER") {
      this.authState = "LOGIN_PASS";
      this.prompt();
      return;
    }

    if (this.authState === "LOGIN_PASS") {
      this.authState = "SHELL";
      this.log.info("client authenticated");
      this.write(BANNER);
      this.prompt();
      return;
    }

    if (!line) { this.prompt(); return; }

    const isAbsolutePath = line.startsWith("/");
    const tokens = (isAbsolutePath ? line.slice(1) : line).split(/\s+/);
    const basePath = isAbsolutePath ? [] : this.menuPath.slice();

    const { path, command, args } = this.router.resolve(basePath, tokens);
    this.router.execute(this, path, command, args);
  }

  private cleanup(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handleInterrupt(): void {
    this.cleanup();
    this.write("\r\nConnection aborted.\r\n");
    this.close();
  }
}

export interface StartServerOptions {
  logger: Logger;
  port: number;
}

export const startServer = (options: StartServerOptions) => {
  const logger = options.logger;
  const router = new CommandRouter();

  router.register("/interface/print", (session) => {
    const table = new Table({
      chars: BORDERLESS_TABLE_CHARS,
      style: { "padding-left": 0, "padding-right": 0 },
      head: [" #", "  ", "NAME", "TYPE", "ACTUAL-MTU", "L2MTU"],
    });

    const seenInterfaces = new Set<string>();
    let interfaceIndex = 0;

    for (const networkInterface of getNetworkInterfaces()) {
      if (seenInterfaces.has(networkInterface.name)) continue;
      seenInterfaces.add(networkInterface.name);

      let interfaceType = "ether";
      if (networkInterface.name.startsWith("lo")) interfaceType = "loopback";
      else if (networkInterface.name.startsWith("wl")) interfaceType = "wlan";

      table.push([
        String(interfaceIndex).padStart(2),
        "R",
        networkInterface.name.padEnd(35),
        interfaceType.padEnd(12),
        "1500",
        "1580",
      ]);
      interfaceIndex++;
    }

    session.write("Flags: X - disabled, R - running\r\n");
    session.write(table.toString().split("\n").join("\r\n") + "\r\n");
    session.prompt();
  });

  router.register("/ip/address/print", (session) => {
    const table = new Table({
      chars: BORDERLESS_TABLE_CHARS,
      style: { "padding-left": 0, "padding-right": 0 },
      head: [" #", "  ", "ADDRESS", "NETWORK", "INTERFACE"],
    });

    let addressIndex = 0;
    for (const networkInterface of getNetworkInterfaces()) {
      if (networkInterface.family !== "IPv4") continue;

      const cidr = networkInterface.cidr ?? networkInterface.ip + "/" + getPrefixLength(networkInterface.netmask);
      const networkAddress = getNetworkAddress(networkInterface.ip, networkInterface.netmask);

      table.push([
        String(addressIndex).padStart(2),
        "D",
        cidr.padEnd(18),
        networkAddress.padEnd(15),
        networkInterface.name,
      ]);
      addressIndex++;
    }

    session.write("Flags: X - disabled, D - dynamic\r\n");
    session.write(table.toString().split("\n").join("\r\n") + "\r\n");
    session.prompt();
  });

  router.register("/system/identity/print", (session) => {
    session.write("name: " + session.getIdentity() + "\r\n");
    session.prompt();
  });

  router.register("/system/identity/set", (session, args) => {
    const parsed = parseKeyValue(args);
    if (parsed["name"]) {
      session.setIdentity(parsed["name"]);
    } else {
      session.write("syntax error: expected name=VALUE\r\n");
    }
    session.prompt();
  });

  router.register("/system/resource/print", (session) => {
    session.writeResourceLine("uptime", getUptime());
    session.writeResourceLine("version", "7.15 (stable)");
    session.writeResourceLine("free-memory", formatMiB(os.freemem()) + "MiB");
    session.writeResourceLine("total-memory", formatMiB(os.totalmem()) + "MiB");
    session.writeResourceLine("cpu", getCpuModel());
    session.writeResourceLine("cpu-count", String(getCpuCount()));
    session.prompt();
  });

  router.register("/ping", (session, args) => {
    const ipAddress = args[0];
    if (ipAddress) {
      session.startPing(ipAddress);
    } else {
      session.write("syntax error: expected IP address\r\n");
      session.prompt();
    }
  });

  router.register("/export", (session) => {
    session.write("# software id = 1234-ABCD\r\n");
    session.write("/ip address\r\n");
    session.write("add address=192.168.88.1/24 interface=ether1 network=192.168.88.0\r\n");
    session.write("/system identity\r\n");
    session.write("set name=" + session.getIdentity() + "\r\n");
    session.prompt();
  });

  const serverInstance = Server((client) => {
    new RouterSession(client, router, logger.child("session"));
  }, { logger });

  serverInstance.on("error", (error: Error) => {
    logger.error("server error: " + error.message);
  });

  serverInstance.listen(options.port);
  return serverInstance;
};
