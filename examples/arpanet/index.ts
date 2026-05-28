import { Server } from "tell";
import { createLogger } from "./logger";
import { TelnetSession } from "./session";

const LISTEN_PORT = 2323;

const logger = createLogger("arpanet");

const server = Server((client) => {
  new TelnetSession(client, logger.child("session"));
}, { logger });

server.on("error", (error: Error) => {
  logger.error("server error: " + error.message);
});

server.listen(LISTEN_PORT, () => {
  logger.info(`listening on port ${LISTEN_PORT}`);
});
