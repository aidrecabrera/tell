import { EventEmitter } from "node:events";
import assert from "node:assert/strict";
import test from "node:test";

import { Commands, Options, TelnetStream, IAC, OPT_TTYPE } from "../index";

class FakeSocket extends EventEmitter {
  public readonly readable = true;
  public readonly writable = true;
  public readonly writes: Buffer[] = [];
  public ended = false;

  public write(data: string | Buffer): boolean {
    let buffer: Buffer;
    if (Buffer.isBuffer(data)) {
      buffer = data;
    } else {
      buffer = Buffer.from(data);
    }
    this.writes.push(buffer);
    return true;
  }

  public end(data?: string | Buffer): this {
    if (data !== undefined) {
      this.write(data);
    }
    this.ended = true;
    return this;
  }

  public destroy(): this {
    return this;
  }

  public pause(): this {
    return this;
  }

  public resume(): this {
    return this;
  }

  public setEncoding(): this {
    return this;
  }
}

const attachedStream = (): [TelnetStream, FakeSocket] => {
  const stream = new TelnetStream();
  const socket = new FakeSocket();
  stream.attachStream(socket);
  return [stream, socket];
};

test("keeps legacy top-level command and option exports", () => {
  assert.equal(IAC, Commands.IAC);
  assert.equal(OPT_TTYPE, Options.OPT_TTYPE);
});

test("write escapes IAC bytes before writing to the socket", () => {
  const [stream, socket] = attachedStream();

  stream.write(Buffer.from([1, Commands.IAC, 2]));

  assert.deepEqual(socket.writes, [Buffer.from([1, Commands.IAC, Commands.IAC, 2])]);
});

test("emits plain data split around telnet commands", () => {
  const [stream] = attachedStream();
  const chunks: string[] = [];
  let interrupted = false;

  stream.on("data", (chunk: Buffer) => chunks.push(chunk.toString("ascii")));
  stream.on("interrupt", () => {
    interrupted = true;
  });

  stream.processIncomingData(Buffer.from([
    ...Buffer.from("ab"),
    Commands.IAC,
    Commands.IP,
    ...Buffer.from("cd"),
  ]));

  assert.deepEqual(chunks, ["ab", "cd"]);
  assert.equal(interrupted, true);
});

test("parses NEW-ENVIRON variables from sub-negotiation payloads", () => {
  const [stream] = attachedStream();
  const changes: unknown[] = [];

  stream.on("environment", (changed: unknown) => {
    changes.push(changed);
  });

  stream.processIncomingData(Buffer.from([
    Commands.IAC,
    Commands.SB,
    Options.OPT_NEW_ENVIRON,
    Options.TELQUAL_IS,
    0,
    ...Buffer.from("USER"),
    1,
    ...Buffer.from("alice"),
    Commands.IAC,
    Commands.SE,
  ]));

  assert.deepEqual(stream.env, { USER: "alice" });
  assert.deepEqual(changes, [{ USER: "alice" }]);
});

test("buffers sub-negotiation payloads split across chunks", () => {
  const [stream] = attachedStream();

  stream.processIncomingData(Buffer.from([
    Commands.IAC,
    Commands.SB,
    Options.OPT_NEW_ENVIRON,
    Options.TELQUAL_IS,
    0,
    ...Buffer.from("USER"),
  ]));
  stream.processIncomingData(Buffer.from([
    1,
    ...Buffer.from("alice"),
    Commands.IAC,
    Commands.SE,
  ]));

  assert.deepEqual(stream.env, { USER: "alice" });
});

test("buffers telnet commands split across chunks", () => {
  const [stream, socket] = attachedStream();

  stream.processIncomingData(Buffer.from([Commands.IAC]));
  stream.processIncomingData(Buffer.from([Commands.DO, Options.OPT_BINARY]));

  assert.equal(stream.binary, true);
  assert.deepEqual(socket.writes, [Buffer.from([Commands.IAC, Commands.WILL, Options.OPT_BINARY])]);
});

test("Server accepts logger option without crashing", () => {
  const { Server, noopLogger } = require("../index");
  const server = Server(() => {}, { logger: noopLogger });
  assert.ok(server);
  server.close();
});

test("Server calls injected logger on connection", (t, done) => {
  const { Server } = require("../index");
  const messages: string[] = [];
  const mockLogger: Logger = {
    debug(msg: string) { messages.push(msg); },
    info(msg: string) { messages.push(msg); },
    warn(msg: string) { messages.push(msg); },
    error(msg: string) { messages.push(msg); },
    child() { return mockLogger; },
  };

  const server = Server(() => {}, { logger: mockLogger });
  server.listen(0, () => {
    const net = require("node:net");
    const address = server.address();
    const client = net.createConnection({ port: address.port, host: "127.0.0.1" });
    client.on("connect", () => {
      setTimeout(() => {
        client.destroy();
        server.close();
        assert.ok(messages.some((msg: string) => msg.includes("connected")));
        done();
      }, 200);
    });
  });
});

test("attachStream throws when called twice", () => {
  const stream = new TelnetStream();
  const socket = new FakeSocket();
  stream.attachStream(socket);
  assert.throws(() => stream.attachStream(socket), /already has an attached stream/);
});
