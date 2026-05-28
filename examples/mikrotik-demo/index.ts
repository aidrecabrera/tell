import net from "node:net";
import { startServer } from "./server";
import { createLogger } from "./logger";

const AUTOMATION_DELAY_MS = 500;
const SERVER_STARTUP_DELAY_MS = 200;
const LISTEN_PORT = 1337;

const TRIGGERS = ["Login:", "Password:", "> ", "MikroTik RouterOS 7.15"];

const AUTOMATION_STEPS = [
  { label: "entering username...", command: "admin\r\n" },
  { label: "entering password...", command: "admin\r\n" },
  { label: "printing system resource...", command: "/system resource print\r\n" },
  { label: "printing interface info...", command: "/interface print\r\n" },
  { label: "customizing hostname...", command: "/system identity set name=GatewayRouter\r\n" },
];

const logger = createLogger("mikrotik");
const server = startServer({ logger, port: LISTEN_PORT });

logger.info("routeros backend initialized on port " + LISTEN_PORT);

const shutdown = () => {
  server.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

setTimeout(() => {
  const socket = net.createConnection({ port: LISTEN_PORT, host: "127.0.0.1" });
  let automationStep = 0;

  const executeNextStep = (): void => {
    const currentAction = AUTOMATION_STEPS[automationStep];
    if (currentAction) {
      console.log("\r\n[automation] " + currentAction.label);
      socket.write(currentAction.command);
      automationStep++;
    } else {
      console.log("\r\n=====================================================");
      console.log(" automation complete. entering freestyle terminal mode.");
      console.log("=====================================================\r\n");

      const standardInput = process.stdin;
      if (standardInput.isTTY) standardInput.setRawMode(true);
      standardInput.resume();
      standardInput.setEncoding("utf8");
      standardInput.pipe(socket);
    }
  };

  socket.on("data", (chunk: Buffer) => {
    const rawOutput = chunk.toString("utf8");
    process.stdout.write(rawOutput);

    if (automationStep < AUTOMATION_STEPS.length && TRIGGERS.some((trigger) => rawOutput.includes(trigger))) {
      setTimeout(executeNextStep, AUTOMATION_DELAY_MS);
    }
  });

  socket.on("close", () => {
    console.log("\r\nsocket connection terminated. shutting down server.");
    shutdown();
  });

  socket.on("error", (error) => {
    logger.error("socket communication error: " + error.message);
    shutdown();
  });
}, SERVER_STARTUP_DELAY_MS);
