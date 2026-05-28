import { EventEmitter } from "node:events";
import assert from "node:assert";
import zlib from "node:zlib";

import {
  DEFLATE_BEST_COMPRESSION_LEVEL,
} from "./constants";
import { parseEnvironment } from "./environment";
import { Commands, Options } from "./protocol";
import { byteAt } from "./utils/byte-at";
import { escapeIac } from "./utils/escape-iac";
import { unquoteIac } from "./utils/unquote-iac";

const callNextNegotiation = (telnet: TelnetStream): void => {
  if (telnet.negotiationCallback !== undefined) {
    telnet.negotiationCallback.call(telnet);
  }
};

export class TelnetStream extends EventEmitter {
  public readonly isTTY = true;
  public env: Environment = {};
  public term: string | undefined;
  public windowSize: [width: number, height: number] | undefined;
  public binary = false;
  public negotiationCallback: NegotiationCallback | undefined;

  private stream: SocketLike | undefined;
  private state = 0;
  private negotiatedOption: number | undefined;
  private deflate: zlib.Deflate | undefined;
  private pendingInput: ByteBuffer = Buffer.alloc(0);
  private pendingSubNegotiation: ByteBuffer = Buffer.alloc(0);

  public get readable(): boolean {
    return this.requireStream().readable;
  }

  public get writable(): boolean {
    return this.requireStream().writable;
  }

  public end(data?: string | ByteBuffer, encoding?: BufferEncoding): this {
    if (data === undefined) {
      this.requireStream().end();
    } else {
      this.requireStream().end(data, encoding);
    }
    return this;
  }

  public write(data: string | ByteBuffer, encoding?: BufferEncoding): boolean {
    let sourceBuffer: ByteBuffer;
    if (Buffer.isBuffer(data)) {
      sourceBuffer = data;
    } else {
      sourceBuffer = Buffer.from(data, encoding);
    }

    const escapedBuffer = escapeIac(sourceBuffer);
    if (this.deflate) {
      this.deflate.write(escapedBuffer);
      this.deflate.flush();
      return true;
    }

    return this.requireStream().write(escapedBuffer);
  }

  public setEncoding(encoding: BufferEncoding): void {
    this.requireStream().setEncoding(encoding);
  }

  public pause(): SocketLike {
    return this.requireStream().pause();
  }

  public resume(): SocketLike {
    return this.requireStream().resume();
  }

  public destroy(error?: Error): this {
    this.requireStream().destroy(error);
    return this;
  }

  public destroySoon(): void {
    this.requireStream().end();
  }

  public pipe<Destination extends NodeJS.WritableStream>(destination: Destination): Destination {
    this.on("data", (chunk: Buffer) => {
      destination.write(chunk);
    });
    this.on("end", () => {
      destination.end();
    });
    return destination;
  }

  public telnetCommand(command: number, option: number | number[]): void {
    let bytes: number[];
    if (Array.isArray(option)) {
      bytes = [Commands.IAC, command, ...option];
    } else {
      bytes = [Commands.IAC, command, option];
    }

    this.requireStream().write(Buffer.from(bytes));
  }

  public processSB(buffer: ByteBuffer): void {
    if (this.pendingSubNegotiation.length > 0) {
      buffer = Buffer.concat([this.pendingSubNegotiation, buffer]);
      this.pendingSubNegotiation = Buffer.alloc(0);
    }

    let didSeeIac = false;

    for (let byteIndex = 0; byteIndex < buffer.length; byteIndex += 1) {
      if (byteAt(buffer, byteIndex) === Commands.IAC) {
        didSeeIac = true;
        continue;
      }

      if (byteAt(buffer, byteIndex) === Commands.SE && didSeeIac) {
        this.handleSubNegotiation(buffer, byteIndex);
        return;
      }

      didSeeIac = false;
    }

    this.pendingSubNegotiation = buffer;
  }

  public processIncomingData(buffer: ByteBuffer): void {
    if (this.pendingInput.length > 0) {
      buffer = Buffer.concat([this.pendingInput, buffer]);
      this.pendingInput = Buffer.alloc(0);
    }

    if (buffer.length === 0) {
      return;
    }

    if (this.state === Commands.SB) {
      this.processSB(buffer);
      return;
    }

    let byteIndex = 0;

    const emitData = (): void => {
      if (byteIndex === 0) {
        return;
      }

      this.emit("data", buffer.subarray(0, byteIndex));
      buffer = buffer.subarray(byteIndex);
      byteIndex = 0;
    };

    const eatBytes = (byteCount: number): void => {
      buffer = buffer.subarray(byteCount);
      byteIndex = 0;
    };

    while (byteIndex < buffer.length) {
      if (byteAt(buffer, byteIndex) !== Commands.IAC) {
        byteIndex += 1;
        continue;
      }

      emitData();
      if (byteIndex + 1 >= buffer.length) {
        this.pendingInput = buffer;
        return;
      }

      const command = byteAt(buffer, byteIndex + 1);

      switch (command) {
        case Commands.IP:
          this.emit("interrupt");
          eatBytes(2);
          break;
        case Commands.SUSP:
          this.emit("suspend");
          eatBytes(2);
          break;
        case Commands.SB:
          if (byteIndex + 2 >= buffer.length) {
            this.pendingInput = buffer;
            return;
          }
          this.negotiatedOption = byteAt(buffer, byteIndex + 2);
          this.state = Commands.SB;
          this.processSB(buffer.subarray(byteIndex + 3));
          return;
        case Commands.WILL:
          if (byteIndex + 2 >= buffer.length) {
            this.pendingInput = buffer;
            return;
          }
          this.processWill(byteAt(buffer, byteIndex + 2));
          eatBytes(3);
          break;
        case Commands.WONT:
          if (byteIndex + 2 >= buffer.length) {
            this.pendingInput = buffer;
            return;
          }
          this.emit("wont", byteAt(buffer, byteIndex + 2));
          eatBytes(3);
          callNextNegotiation(this);
          break;
        case Commands.DO:
          if (byteIndex + 2 >= buffer.length) {
            this.pendingInput = buffer;
            return;
          }
          this.processDo(byteAt(buffer, byteIndex + 2));
          eatBytes(3);
          break;
        case Commands.DONT:
          if (byteIndex + 2 >= buffer.length) {
            this.pendingInput = buffer;
            return;
          }
          this.processDont(byteAt(buffer, byteIndex + 2));
          eatBytes(3);
          break;
        default:
          this.emit("unknownCommand", command);
          eatBytes(2);
      }
    }

    if (buffer.length > 0) {
      emitData();
    }
  }

  public attachStream(socket: SocketLike): void {
    assert(this.stream === undefined, "TelnetStream already has an attached stream");
    this.stream = socket;

    socket.on("data", (buffer: ByteBuffer) => {
      this.processIncomingData(buffer);
    });
    socket.on("close", () => {
      this.emit("close");
    });
    socket.on("end", () => {
      this.emit("end");
    });
    socket.on("error", (error: Error) => {
      this.emit("error", error);
    });
  }

  private processWill(option: number): void {
    switch (option) {
      case Options.OPT_TTYPE:
        this.telnetCommand(Commands.SB, [
          Options.OPT_TTYPE,
          Options.TELQUAL_SEND,
          Commands.IAC,
          Commands.SE,
        ]);
        return;
      case Options.OPT_NEW_ENVIRON:
        this.telnetCommand(Commands.SB, [
          Options.OPT_NEW_ENVIRON,
          Options.TELQUAL_SEND,
          Commands.IAC,
          Commands.SE,
        ]);
        return;
      case Options.OPT_COMPRESS2:
        this.telnetCommand(Commands.SB, [Options.OPT_COMPRESS2, Commands.IAC, Commands.SE]);
        this.deflate = zlib.createDeflate({ level: DEFLATE_BEST_COMPRESSION_LEVEL });
        this.deflate.on("data", (compressedChunk: ByteBuffer) => {
          this.requireStream().write(compressedChunk);
        });
        callNextNegotiation(this);
        return;
      case Options.OPT_WINDOW_SIZE:
        return;
      case Options.OPT_BINARY:
        this.binary = true;
        this.emit("will", option);
        callNextNegotiation(this);
        return;
      default:
        this.emit("will", option);
        callNextNegotiation(this);
    }
  }

  private processDo(option: number): void {
    switch (option) {
      case Options.OPT_TIMING_MARK:
        this.telnetCommand(Commands.WILL, Options.OPT_TIMING_MARK);
        break;
      case Options.OPT_BINARY:
        this.binary = true;
        this.telnetCommand(Commands.WILL, Options.OPT_BINARY);
        break;
      default:
        if (!this.emit("do", option)) {
          this.telnetCommand(Commands.WONT, option);
        }
    }
  }

  private processDont(option: number): void {
    if (!this.emit("dont", option)) {
      this.telnetCommand(Commands.WONT, option);
    }
  }

  private handleSubNegotiation(buffer: ByteBuffer, endIndex: number): void {
    assert(this.negotiatedOption !== undefined, "handleSubNegotiation called without negotiatedOption");
    const payload = unquoteIac(buffer.subarray(0, endIndex - 1));
    this.state = 0;

    switch (this.negotiatedOption) {
      case Options.OPT_WINDOW_SIZE:
        this.windowSize = [
          payload.readUInt16BE(0),
          payload.readUInt16BE(2),
        ];
        this.emit("resize", this.windowSize[0], this.windowSize[1]);
        break;
      case Options.OPT_NEW_ENVIRON:
        parseEnvironment(this, payload);
        break;
      case Options.OPT_TTYPE:
        this.term = payload.toString("ascii", 1);
        this.emit("negotiated", this.negotiatedOption, payload);
        break;
      default:
        this.emit("negotiated", this.negotiatedOption, payload);
    }

    if (endIndex + 2 <= buffer.length) {
      this.processIncomingData(buffer.subarray(endIndex + 2));
    }

    callNextNegotiation(this);
  }

  private requireStream(): SocketLike {
    if (!this.stream) {
      throw new Error("TelnetStream is not attached to a socket");
    }
    return this.stream;
  }
}
