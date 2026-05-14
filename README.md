# tell

A TypeScript telnet helper for Node.js. Gives you a `TelnetStream` that feels close to a normal socket while handling telnet details like option negotiation, escaped IAC bytes, terminal type, window size, environment variables, binary mode, and basic compression.

## Install

```sh
npm install
```

## Use

```ts
import { Server } from "tell";

const server = Server((connection) => {
  const [width, height] = connection.windowSize ?? [0, 0];

  console.log("client connected");
  console.log("terminal:", connection.term ?? "unknown");
  console.log("size:", `${width}x${height}`);
  console.log("env:", connection.env);

  connection.write("hello from tell\r\n> ");

  connection.on("data", (chunk: Buffer) => {
    const input = chunk.toString("utf8").trim();
    connection.write(`you said: ${input}\r\n> `);
  });

  connection.on("resize", (nextWidth: number, nextHeight: number) => {
    console.log("resized:", `${nextWidth}x${nextHeight}`);
  });

  connection.on("interrupt", () => {
    connection.end("bye\r\n");
  });
});

server.listen(1337, () => {
  console.log("telnet server listening on 1337");
});
```

Connect with:

```sh
telnet localhost 1337
```

## API

- `Server(listener)`
  - Creates a `net.Server`
  - Passes a negotiated `TelnetStream` to the listener

- `TelnetStream`
  - Wraps a socket-like stream
  - Emits `data`, `end`, `close`, `error`, `resize`, `environment`, `interrupt`, `suspend`, `will`, `wont`, `do`, `dont`, and `negotiated`

- `Commands`, `Options`, and legacy telnet constants`
  - For working directly with telnet bytes

## Scripts

```sh
npm run build
npm run typecheck
npm test
```

## Status

Early. Test carefully before using it in places that need hardened protocol handling.
