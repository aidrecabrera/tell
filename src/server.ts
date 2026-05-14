import net from "node:net";

import { Commands, Options } from "./protocol";
import { TelnetStream } from "./telnet-stream";

export const Server = (connectionListener: TelnetConnectionListener): net.Server => {
  const server = net.createServer({}, (connection) => {
    const telnetStream = new TelnetStream();
    telnetStream.attachStream(connection);

    const options = [
      Options.OPT_TTYPE,
      Options.OPT_WINDOW_SIZE,
      Options.OPT_NEW_ENVIRON,
      Options.OPT_BINARY,
      Options.OPT_COMPRESS2,
    ];

    const negotiateNext = (): void => {
      const option = options.shift();
      if (option === undefined) {
        telnetStream.negotiationCallback = undefined;
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
