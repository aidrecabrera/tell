# tell

Telnet for Node.js in TypeScript. Wraps a raw socket into a `TelnetStream` that handles option negotiation, IAC escaping, terminal type, window size, environment variables, binary mode, and compression so you don't have to.

## Install

```sh
npm install
```

## Use

```ts
import { Server } from "tell";

const server = Server((connection) => {
  const [width, height] = connection.windowSize ?? [0, 0];

  console.log("terminal:", connection.term ?? "unknown");
  console.log("size:", `${width}x${height}`);

  connection.write("hello from tell\r\n> ");

  connection.on("data", (chunk: Buffer) => {
    const input = chunk.toString("utf8").trim();
    connection.write(`you said: ${input}\r\n> `);
  });

  connection.on("interrupt", () => {
    connection.end("bye\r\n");
  });
});

server.listen(1337);
```

## Logger

Pass any object matching this shape to `Server(handler, { logger })`. If you don't, nothing gets logged.

```ts
interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  child(scope: string): Logger;
}
```

pino, winston, consola — wrap them to match the interface and you're done. See `examples/arpanet/logger.ts` for a pino adapter.

## Structure

```
packages/tell/          — the library (zero runtime deps)
examples/arpanet/       — multi-user time-sharing system (pino, figlet, cli-table3, picocolors)
examples/mikrotik-demo/ — MikroTik RouterOS simulator (pino, cli-table3, picocolors)
```

## Scripts

```sh
npm run build        # build all workspaces
npm test             # run library tests
npm run arpanet      # build & run the time-sharing demo
npm run mikrotik     # build & run the RouterOS simulator
```

## Running the examples

Start the arpanet time-sharing system:

```sh
npm run arpanet
```

Then connect from another terminal:

```sh
telnet localhost 2323
```

Login with `admin`/`admin` or `guest`/`guest`. You get a shell with `who`, `finger`, `write`, `wall`, `ps`, `df`, and others.

```
login: admin
password:

  _                   _
 | | _____   _____| | __ _  ___ ___
 | |/ _ \ \ / / _ \ |/ _` |/ __/ _ \
 | | (_) \ V /  __/ | (_| | (_|  __/
 |_|\___/ \_/ \___|_|\__,_|\___\___|

  Thu May 29 2026
  type 'help' for available commands

admin@lovelace$ who
admin  xterm-256color  80x24  3s ago  unknown
admin@lovelace$ hostname
lovelace
admin@lovelace$ logout
goodbye.
```

Start the MikroTik RouterOS simulator:

```sh
npm run mikrotik
```

This runs an automated sequence (login, `/system resource print`, `/interface print`, identity change) then drops you into a live RouterOS-style CLI.

```
MikroTik 7.15
Login: admin
Password:
  MMM      MMM       KKK                          TTTTTTTTTTT      KKK
  MMMM    MMMM       KKK                          TTTTTTTTTTT      KKK
  MMM MMMM MMM  III  KKK  KKK  RRRRRR   OOOOOO        TTT     III  KKK  KKK
  MMM  MM  MMM  III  KKKKK     RRR  RR OOO  OOO       TTT     III  KKKKK
  MMM      MMM  III  KKK KKK   RRRRRR  OOO  OOO       TTT     III  KKK KKK
  MMM      MMM  III  KKK  KKK  RRR  RR  OOOOOO        TTT     III  KKK  KKK

  MikroTik RouterOS 7.15 (c) 1999-2024 http://www.mikrotik.com/

[admin@MikroTik] > /system resource print
                   uptime: 2d14h32m7s
                  version: 7.15 (stable)
              free-memory: 12041.3MiB
             total-memory: 15896.2MiB
                      cpu: 13th Gen Intel(R) Core(TM) i7-13700K
                cpu-count: 24
[admin@MikroTik] > /ip address print
Flags: X - disabled, D - dynamic
 #   ADDRESS            NETWORK         INTERFACE
 0 D 192.168.1.100/24   192.168.1.0     eth0
 1 D 127.0.0.1/8        127.0.0.0       lo
[admin@MikroTik] > /system identity set name=GatewayRouter
[admin@GatewayRouter] >
```

Try `/ping 8.8.8.8` or `/export`.

## API

- `Server(listener, options?)` — creates a `net.Server`, negotiates telnet options, passes a ready `TelnetStream` to the listener
- `TelnetStream` — emits `data`, `end`, `close`, `error`, `resize`, `environment`, `interrupt`, `suspend`, `will`, `wont`, `do`, `dont`, `negotiated`
- `Commands`, `Options` — protocol byte constants
- `noopLogger` — silent logger (the default)

## Status

Early. Not battle-tested. Use at your own risk in anything that matters.
