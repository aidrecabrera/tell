# tell

A TypeScript telnet helper for Node.js. Gives you a `TelnetStream` that feels close to a normal socket while handling telnet details like option negotiation, escaped IAC bytes, terminal type, window size, environment variables, binary mode, and basic compression.

## Install

```sh
npm install
```

## Use

```ts
import { Server } from "tell";
import pino from "pino";

const logger = pino({ name: "my-app" });

const server = Server((connection) => {
  const [width, height] = connection.windowSize ?? [0, 0];

  console.log("client connected");
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
}, { logger });

server.listen(1337, () => {
  console.log("telnet server listening on 1337");
});
```

## Logger Injection

The library accepts any logger satisfying the `Logger` interface:

```ts
interface Logger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  child(scope: string): Logger;
}
```

Pass it via `Server(handler, { logger })`. If omitted, a silent no-op logger is used.

## Workspace Structure

```
packages/tell/    — the library (zero runtime dependencies)
examples/arpanet/ — multi-user time-sharing demo (pino, figlet, cli-table3, picocolors)
examples/mikrotik-demo/ — MikroTik RouterOS simulator (pino, cli-table3, picocolors)
```

## Scripts

```sh
npm run build        # build all workspaces
npm test             # run library tests
npm run arpanet      # build & run the time-sharing demo
npm run mikrotik     # build & run the RouterOS simulator
```

## API

- `Server(listener, options?)` — Creates a `net.Server`, passes a negotiated `TelnetStream` to the listener
- `TelnetStream` — Wraps a socket-like stream, emits `data`, `end`, `close`, `error`, `resize`, `environment`, `interrupt`, `suspend`, `will`, `wont`, `do`, `dont`, `negotiated`
- `Commands`, `Options` — Telnet protocol constants
- `noopLogger` — Silent logger satisfying the `Logger` interface

## Status

Early. Test carefully before using it in places that need hardened protocol handling.
