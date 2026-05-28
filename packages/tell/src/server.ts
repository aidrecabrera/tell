import net from "node:net";

import { Commands, Options } from "./protocol";
import { noopLogger } from "./logger";
import { TelnetStream } from "./telnet-stream";

export const Server = (connectionListener: TelnetConnectionListener, options?: ServerOptions): net.Server => {
  const logger = options?.logger ?? noopLogger;

  const server = net.createServer({}, (connection) => {
    const telnetStream = new TelnetStream();
    telnetStream.attachStream(connection);
    logger.debug("client connected");

    const pendingOptions = [
      Options.OPT_TTYPE,
      Options.OPT_WINDOW_SIZE,
      Options.OPT_NEW_ENVIRON,
      Options.OPT_BINARY,
      Options.OPT_COMPRESS2,
    ];

    const negotiateNext = (): void => {
      const option = pendingOptions.shift();
      if (option === undefined) {
        telnetStream.negotiationCallback = undefined;
        logger.info("client negotiated");
        server.emit("connected", telnetStream);
        return;
      }

      telnetStream.telnetCommand(Commands.DO, option);
    };

    telnetStream.negotiationCallback = negotiateNext;
    negotiateNext();
  });

  server.on("connected", connectionListener);
  return server;
};
