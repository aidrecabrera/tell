import { EventEmitter } from "node:events";
import net from "node:net";

declare global {
  interface ByteBuffer extends Buffer<ArrayBufferLike> {}

  interface Environment {
    [name: string]: string | null;
  }

  interface Logger {
    debug(msg: string): void;
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
    child(scope: string): Logger;
  }

  interface ServerOptions {
    logger?: Logger;
  }

  interface NegotiationCallback {
    (): void;
  }

  interface TelnetConnectionListener {
    (stream: import("./telnet-stream").TelnetStream): void;
  }

  interface EnvironmentTarget {
    env: Environment;
    emit(eventName: "environment", changedEnvironment: Environment): boolean;
  }

  interface SocketLike extends EventEmitter {
    readonly readable: boolean;
    readonly writable: boolean;
    write(buffer: string | Uint8Array, encoding?: BufferEncoding): boolean;
    end(buffer?: string | Uint8Array, encoding?: BufferEncoding): this;
    destroy(error?: Error): this;
    pause(): this;
    resume(): this;
    setEncoding(encoding: BufferEncoding): this;
  }

  interface ServerConnection extends net.Socket {}
}

export {};
